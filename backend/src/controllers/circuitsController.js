const fs = require('fs/promises');
const path = require('path');
const pool = require('../config/db');
const normalizeCountryCode = require('../utils/countryCode');

const publicDir = require('../utils/publicDir');

const toPublicImagePath = (file, folder) => {
  if (!file) return '';

  return `/media/circuitos/${folder}/${file.filename}`;
};

const normalizeExistingMediaPath = value => {
  const mediaPath = String(value || '').trim();

  return mediaPath.startsWith('/media/') ? mediaPath : '';
};

const getUploadedFile = (files, fieldName) => {
  if (!files?.[fieldName]?.length) return null;

  return files[fieldName][0];
};

const deleteMediaIfUnused = async (mediaPath, column) => {
  if (!mediaPath || !['imagen', 'trazado'].includes(column)) return;

  const [references] = await pool.query(
    `SELECT COUNT(*) AS total FROM circuitos WHERE ${column} = ?`,
    [mediaPath]
  );
  if (Number(references[0]?.total) > 0) return;

  const relativePath = String(mediaPath).replace(/^[/\\]+/, '');
  const absolutePath = path.resolve(publicDir, relativePath);
  const circuitMediaDir = path.resolve(publicDir, 'media', 'circuitos');
  if (!absolutePath.startsWith(`${circuitMediaDir}${path.sep}`)) return;

  try {
    await fs.unlink(absolutePath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn(`No se pudo eliminar el archivo anterior ${mediaPath}:`, err.message);
    }
  }
};

const capitalizeValue = value =>
  String(value || '')
    .trim()
    .toLocaleLowerCase('es-AR')
    .replace(/(^|\s|-|\/)(\p{L})/gu, (match, separator, letter) => `${separator}${letter.toLocaleUpperCase('es-AR')}`);

const normalizeCircuitFields = body => ({
  nombre: capitalizeValue(body.nombre),
  localidad: capitalizeValue(body.localidad),
  provincia: capitalizeValue(body.provincia),
  pais: normalizeCountryCode(body.pais),
  variante: String(body.variante || '').trim().toLocaleLowerCase('es-AR'),
});

const getAll = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, nombre, localidad, provincia, pais, imagen, trazado, variante FROM circuitos ORDER BY nombre ASC'
    );
    res.json({ data: rows, total: rows.length });
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const [[row]] = await pool.query('SELECT * FROM circuitos WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Circuito no encontrado' });

    res.json({ data: row });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { nombre, localidad, provincia, pais, variante } = normalizeCircuitFields(req.body);
    if (!nombre) return res.status(400).json({ error: 'nombre es requerido' });

    const imagen = toPublicImagePath(getUploadedFile(req.files, 'imagen'), 'fotos') || normalizeExistingMediaPath(req.body.imagen_actual);
    const trazado = toPublicImagePath(getUploadedFile(req.files, 'trazado'), 'trazados');
    const [result] = await pool.query(
      'INSERT INTO circuitos (nombre, localidad, provincia, pais, imagen, trazado, variante) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [nombre, localidad || '', provincia || '', pais || '', imagen, trazado, variante]
    );

    res.status(201).json({
      data: { id: result.insertId, nombre, localidad, provincia, pais, imagen, trazado, variante },
      message: 'Circuito creado',
    });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const { nombre, localidad, provincia, pais, variante } = normalizeCircuitFields(req.body);
    if (!nombre) return res.status(400).json({ error: 'nombre es requerido' });

    const [[current]] = await pool.query('SELECT imagen, trazado FROM circuitos WHERE id = ?', [req.params.id]);
    if (!current) return res.status(404).json({ error: 'Circuito no encontrado' });

    const imagenFile = getUploadedFile(req.files, 'imagen');
    const trazadoFile = getUploadedFile(req.files, 'trazado');
    const imagen = imagenFile ? toPublicImagePath(imagenFile, 'fotos') : current.imagen;
    const trazado = trazadoFile ? toPublicImagePath(trazadoFile, 'trazados') : current.trazado;
    const [result] = await pool.query(
      'UPDATE circuitos SET nombre=?, localidad=?, provincia=?, pais=?, imagen=?, trazado=?, variante=? WHERE id=?',
      [nombre, localidad || '', provincia || '', pais || '', imagen || '', trazado || '', variante, req.params.id]
    );

    if (!result.affectedRows) return res.status(404).json({ error: 'Circuito no encontrado' });

    const cleanupTasks = [];
    if (imagenFile && current.imagen !== imagen) cleanupTasks.push(deleteMediaIfUnused(current.imagen, 'imagen'));
    if (trazadoFile && current.trazado !== trazado) cleanupTasks.push(deleteMediaIfUnused(current.trazado, 'trazado'));

    const cleanupResults = await Promise.allSettled(cleanupTasks);
    cleanupResults
      .filter(result => result.status === 'rejected')
      .forEach(result => console.warn('No se pudo limpiar un archivo anterior:', result.reason?.message));

    res.json({
      message: 'Circuito actualizado',
      data: { id: req.params.id, nombre, localidad, provincia, pais, imagen, trazado, variante },
    });
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM circuitos WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Circuito no encontrado' });

    res.json({ message: 'Circuito eliminado' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getById, create, update, remove };
