const pool = require('../config/db');

const toPublicMediaPath = (file, folder) => {
  if (!file) return '';

  return `/media/autos/${folder}/${file.filename}`;
};

const getUploadedFile = (files, fieldName) => {
  if (!files?.[fieldName]?.length) return null;

  return files[fieldName][0];
};

const capitalizeValue = value =>
  String(value || '')
    .trim()
    .toLocaleLowerCase('es-AR')
    .replace(/(^|\s|-|\/)(\p{L})/gu, (match, separator, letter) => `${separator}${letter.toLocaleUpperCase('es-AR')}`);

const getAll = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.id, a.idcategoria, a.marca, a.modelo, a.logo, a.imagen,
              cat.categoria
       FROM autos a
       JOIN categorias cat ON a.idcategoria = cat.id
       ORDER BY cat.categoria ASC, a.marca ASC, a.modelo ASC`
    );
    res.json({ data: rows, total: rows.length });
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const [[row]] = await pool.query(
      `SELECT a.id, a.idcategoria, a.marca, a.modelo, a.logo, a.imagen,
              cat.categoria
       FROM autos a
       JOIN categorias cat ON a.idcategoria = cat.id
       WHERE a.id = ?`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ error: 'Auto no encontrado' });

    res.json({ data: row });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const idcategoria = req.body.idcategoria;
    const marca = capitalizeValue(req.body.marca);
    const modelo = capitalizeValue(req.body.modelo);

    if (!idcategoria || !marca || !modelo) {
      return res.status(400).json({ error: 'idcategoria, marca y modelo son requeridos' });
    }

    const logo = toPublicMediaPath(getUploadedFile(req.files, 'logo'), 'logos');
    const imagen = toPublicMediaPath(getUploadedFile(req.files, 'imagen'), 'imagenes');
    const [result] = await pool.query(
      'INSERT INTO autos (idcategoria, marca, modelo, logo, imagen) VALUES (?, ?, ?, ?, ?)',
      [idcategoria, marca, modelo, logo, imagen]
    );

    res.status(201).json({
      data: { id: result.insertId, idcategoria, marca, modelo, logo, imagen },
      message: 'Auto agregado',
    });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const idcategoria = req.body.idcategoria;
    const marca = capitalizeValue(req.body.marca);
    const modelo = capitalizeValue(req.body.modelo);

    if (!idcategoria || !marca || !modelo) {
      return res.status(400).json({ error: 'idcategoria, marca y modelo son requeridos' });
    }

    const [[current]] = await pool.query('SELECT logo, imagen FROM autos WHERE id = ?', [req.params.id]);
    if (!current) return res.status(404).json({ error: 'Auto no encontrado' });

    const logoFile = getUploadedFile(req.files, 'logo');
    const imageFile = getUploadedFile(req.files, 'imagen');
    const logo = logoFile ? toPublicMediaPath(logoFile, 'logos') : current.logo;
    const imagen = imageFile ? toPublicMediaPath(imageFile, 'imagenes') : current.imagen;
    const [result] = await pool.query(
      'UPDATE autos SET idcategoria=?, marca=?, modelo=?, logo=?, imagen=? WHERE id=?',
      [idcategoria, marca, modelo, logo || '', imagen || '', req.params.id]
    );

    if (!result.affectedRows) return res.status(404).json({ error: 'Auto no encontrado' });

    res.json({
      message: 'Auto actualizado',
      data: { id: req.params.id, idcategoria, marca, modelo, logo, imagen },
    });
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM autos WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Auto no encontrado' });

    res.json({ message: 'Auto eliminado' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getById, create, update, remove };
