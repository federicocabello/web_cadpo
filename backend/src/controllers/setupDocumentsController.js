const fs = require('fs/promises');
const path = require('path');
const pool = require('../config/db');
const publicDir = require('../utils/publicDir');

let schemaPromise;

const ensureSchema = () => {
  if (!schemaPromise) {
    schemaPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS documentos_puesta_a_punto (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        titulo VARCHAR(180) NOT NULL,
        descripcion TEXT NULL,
        archivo VARCHAR(500) NOT NULL,
        nombre_original VARCHAR(255) NOT NULL,
        tamano BIGINT UNSIGNED NOT NULL DEFAULT 0,
        visible TINYINT(1) NOT NULL DEFAULT 1,
        orden INT NOT NULL DEFAULT 0,
        creado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        actualizado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_documentos_puesta_visible_orden (visible, orden, creado)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(error => { schemaPromise = null; throw error; });
  }
  return schemaPromise;
};

const normalizeText = (value, maxLength = 5000) => String(value || '').trim().slice(0, maxLength);
const publicPathFor = filename => `/media/puesta-a-punto/documentos/${filename}`;
const absolutePathFor = value => {
  const filename = path.basename(String(value || ''));
  return path.join(publicDir, 'media', 'puesta-a-punto', 'documentos', filename);
};
const removeUploadedFile = async file => {
  if (!file?.path) return;
  await fs.unlink(file.path).catch(error => { if (error.code !== 'ENOENT') throw error; });
};
const removeStoredFile = async value => {
  if (!String(value || '').startsWith('/media/puesta-a-punto/documentos/')) return;
  await fs.unlink(absolutePathFor(value)).catch(error => { if (error.code !== 'ENOENT') throw error; });
};

const loadDocuments = async includeHidden => {
  await ensureSchema();
  const [rows] = await pool.query(`
    SELECT id, titulo, descripcion, archivo, nombre_original, tamano, visible, orden, creado, actualizado
    FROM documentos_puesta_a_punto
    ${includeHidden ? '' : 'WHERE visible = 1'}
    ORDER BY orden ASC, creado DESC, id DESC
  `);
  return rows.map(row => ({ ...row, visible: Boolean(row.visible), tamano: Number(row.tamano || 0) }));
};

const getPublic = async (req, res, next) => {
  try {
    const data = await loadDocuments(false);
    res.json({ data, total: data.length });
  } catch (error) { next(error); }
};

const getAdmin = async (req, res, next) => {
  try {
    const data = await loadDocuments(true);
    res.json({ data, total: data.length });
  } catch (error) { next(error); }
};

const create = async (req, res, next) => {
  try {
    await ensureSchema();
    const titulo = normalizeText(req.body.titulo, 180);
    if (!titulo || !req.file) {
      await removeUploadedFile(req.file);
      return res.status(400).json({ error: 'Ingresá un título y seleccioná un archivo PDF' });
    }
    const descripcion = normalizeText(req.body.descripcion);
    const visible = String(req.body.visible ?? '1') === '0' || String(req.body.visible).toLowerCase() === 'false' ? 0 : 1;
    const orden = Number.isFinite(Number(req.body.orden)) ? Math.trunc(Number(req.body.orden)) : 0;
    const archivo = publicPathFor(req.file.filename);
    const [result] = await pool.query(
      `INSERT INTO documentos_puesta_a_punto
       (titulo, descripcion, archivo, nombre_original, tamano, visible, orden)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [titulo, descripcion, archivo, req.file.originalname, req.file.size, visible, orden],
    );
    const data = (await loadDocuments(true)).find(item => Number(item.id) === Number(result.insertId));
    res.status(201).json({ data, message: 'Documento cargado correctamente' });
  } catch (error) {
    await removeUploadedFile(req.file).catch(() => {});
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    await ensureSchema();
    const [[current]] = await pool.query('SELECT * FROM documentos_puesta_a_punto WHERE id = ?', [req.params.id]);
    if (!current) {
      await removeUploadedFile(req.file);
      return res.status(404).json({ error: 'Documento no encontrado' });
    }
    const titulo = normalizeText(req.body.titulo, 180);
    if (!titulo) {
      await removeUploadedFile(req.file);
      return res.status(400).json({ error: 'Ingresá el título del documento' });
    }
    const descripcion = normalizeText(req.body.descripcion);
    const visible = String(req.body.visible ?? current.visible) === '0' || String(req.body.visible).toLowerCase() === 'false' ? 0 : 1;
    const orden = Number.isFinite(Number(req.body.orden)) ? Math.trunc(Number(req.body.orden)) : Number(current.orden || 0);
    const archivo = req.file ? publicPathFor(req.file.filename) : current.archivo;
    const nombreOriginal = req.file?.originalname || current.nombre_original;
    const tamano = req.file?.size || current.tamano;
    await pool.query(
      `UPDATE documentos_puesta_a_punto
       SET titulo = ?, descripcion = ?, archivo = ?, nombre_original = ?, tamano = ?, visible = ?, orden = ?
       WHERE id = ?`,
      [titulo, descripcion, archivo, nombreOriginal, tamano, visible, orden, req.params.id],
    );
    if (req.file) await removeStoredFile(current.archivo);
    const data = (await loadDocuments(true)).find(item => Number(item.id) === Number(req.params.id));
    res.json({ data, message: 'Documento actualizado correctamente' });
  } catch (error) {
    await removeUploadedFile(req.file).catch(() => {});
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await ensureSchema();
    const [[current]] = await pool.query('SELECT archivo FROM documentos_puesta_a_punto WHERE id = ?', [req.params.id]);
    if (!current) return res.status(404).json({ error: 'Documento no encontrado' });
    await pool.query('DELETE FROM documentos_puesta_a_punto WHERE id = ?', [req.params.id]);
    await removeStoredFile(current.archivo);
    res.json({ message: 'Documento eliminado correctamente' });
  } catch (error) { next(error); }
};

module.exports = { create, getAdmin, getPublic, remove, update };
