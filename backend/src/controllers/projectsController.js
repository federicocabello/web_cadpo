const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const pool = require('../config/db');
const publicDir = require('../utils/publicDir');

const projectsRoot = path.join(publicDir, 'media', 'proyectos');
let schemaPromise;

const ensureSchema = () => {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS proyectos (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          tipo VARCHAR(20) NOT NULL,
          titulo VARCHAR(180) NOT NULL,
          descripcion TEXT NULL,
          activo TINYINT(1) NOT NULL DEFAULT 1,
          creado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          actualizado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_proyectos_tipo_activo (tipo, activo)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS proyecto_fotos (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          idproyecto INT UNSIGNED NOT NULL,
          imagen VARCHAR(500) NOT NULL,
          orden INT NOT NULL DEFAULT 0,
          creado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_proyecto_fotos_proyecto (idproyecto)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    })().catch(error => { schemaPromise = null; throw error; });
  }
  return schemaPromise;
};

const normalizeText = value => String(value || '').trim();
const normalizeType = value => ['categoria', 'circuito'].includes(String(value || '').toLowerCase())
  ? String(value).toLowerCase()
  : '';
const projectDirectory = id => path.join(projectsRoot, String(Number(id)));

const writeImage = async (id, file) => {
  const extension = path.extname(file.originalname).toLowerCase();
  const filename = `foto-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`;
  await fs.mkdir(projectDirectory(id), { recursive: true });
  await fs.writeFile(path.join(projectDirectory(id), filename), file.buffer);
  return `/media/proyectos/${Number(id)}/${filename}`;
};

const removeImage = async value => {
  const match = String(value || '').match(/^\/media\/proyectos\/(\d+)\/([^/]+)$/);
  if (!match) return;
  await fs.unlink(path.join(projectDirectory(match[1]), path.basename(match[2]))).catch(error => {
    if (error.code !== 'ENOENT') throw error;
  });
};

const loadProjects = async includeInactive => {
  await ensureSchema();
  const [projects] = await pool.query(`
    SELECT id, tipo, titulo, descripcion, activo, creado, actualizado
    FROM proyectos ${includeInactive ? '' : 'WHERE activo = 1'}
    ORDER BY tipo ASC, creado DESC, id DESC
  `);
  if (!projects.length) return [];
  const [photos] = await pool.query(`
    SELECT id, idproyecto, imagen, orden FROM proyecto_fotos
    WHERE idproyecto IN (?) ORDER BY orden ASC, id ASC
  `, [projects.map(project => project.id)]);
  const grouped = photos.reduce((result, photo) => {
    const key = String(photo.idproyecto);
    if (!result[key]) result[key] = [];
    result[key].push(photo);
    return result;
  }, {});
  return projects.map(project => ({ ...project, activo: Boolean(project.activo), fotos: grouped[String(project.id)] || [] }));
};

const getPublic = async (req, res, next) => {
  try { const data = await loadProjects(false); res.json({ data, total: data.length }); } catch (error) { next(error); }
};

const getAdmin = async (req, res, next) => {
  try { const data = await loadProjects(true); res.json({ data, total: data.length }); } catch (error) { next(error); }
};

const savePhotos = async (id, files) => {
  const [[last]] = await pool.query('SELECT COALESCE(MAX(orden), -1) AS orden FROM proyecto_fotos WHERE idproyecto = ?', [id]);
  for (let index = 0; index < files.length; index += 1) {
    const image = await writeImage(id, files[index]);
    await pool.query('INSERT INTO proyecto_fotos (idproyecto, imagen, orden) VALUES (?, ?, ?)', [id, image, Number(last.orden) + index + 1]);
  }
};

const create = async (req, res, next) => {
  try {
    await ensureSchema();
    const tipo = normalizeType(req.body.tipo);
    const titulo = normalizeText(req.body.titulo);
    if (!tipo || !titulo) return res.status(400).json({ error: 'Seleccioná el tipo e ingresá el título del proyecto' });
    const descripcion = normalizeText(req.body.descripcion);
    const activo = req.body.activo === 'false' || req.body.activo === '0' ? 0 : 1;
    const [result] = await pool.query('INSERT INTO proyectos (tipo, titulo, descripcion, activo) VALUES (?, ?, ?, ?)', [tipo, titulo, descripcion, activo]);
    await savePhotos(result.insertId, req.files || []);
    const data = (await loadProjects(true)).find(project => Number(project.id) === Number(result.insertId));
    res.status(201).json({ data, message: 'Proyecto creado correctamente' });
  } catch (error) { next(error); }
};

const update = async (req, res, next) => {
  try {
    await ensureSchema();
    const [[current]] = await pool.query('SELECT id FROM proyectos WHERE id = ?', [req.params.id]);
    if (!current) return res.status(404).json({ error: 'Proyecto no encontrado' });
    const tipo = normalizeType(req.body.tipo);
    const titulo = normalizeText(req.body.titulo);
    if (!tipo || !titulo) return res.status(400).json({ error: 'Seleccioná el tipo e ingresá el título del proyecto' });
    const descripcion = normalizeText(req.body.descripcion);
    const activo = req.body.activo === 'true' || req.body.activo === '1' ? 1 : 0;
    await pool.query('UPDATE proyectos SET tipo = ?, titulo = ?, descripcion = ?, activo = ? WHERE id = ?', [tipo, titulo, descripcion, activo, req.params.id]);
    await savePhotos(req.params.id, req.files || []);
    const data = (await loadProjects(true)).find(project => Number(project.id) === Number(req.params.id));
    res.json({ data, message: 'Proyecto actualizado correctamente' });
  } catch (error) { next(error); }
};

const removePhoto = async (req, res, next) => {
  try {
    await ensureSchema();
    const [[photo]] = await pool.query('SELECT imagen FROM proyecto_fotos WHERE id = ? AND idproyecto = ?', [req.params.photoId, req.params.id]);
    if (!photo) return res.status(404).json({ error: 'Foto no encontrada' });
    await pool.query('DELETE FROM proyecto_fotos WHERE id = ? AND idproyecto = ?', [req.params.photoId, req.params.id]);
    await removeImage(photo.imagen);
    res.json({ message: 'Foto eliminada correctamente' });
  } catch (error) { next(error); }
};

const remove = async (req, res, next) => {
  try {
    await ensureSchema();
    const [[project]] = await pool.query('SELECT id FROM proyectos WHERE id = ?', [req.params.id]);
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });
    await pool.query('DELETE FROM proyecto_fotos WHERE idproyecto = ?', [req.params.id]);
    await pool.query('DELETE FROM proyectos WHERE id = ?', [req.params.id]);
    await fs.rm(projectDirectory(req.params.id), { recursive: true, force: true });
    res.json({ message: 'Proyecto eliminado correctamente' });
  } catch (error) { next(error); }
};

module.exports = { create, getAdmin, getPublic, remove, removePhoto, update };
