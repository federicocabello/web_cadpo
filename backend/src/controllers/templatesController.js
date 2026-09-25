const fs = require('fs/promises');
const path = require('path');
const pool = require('../config/db');
const publicDir = require('../utils/publicDir');

const ensureTemplateTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS plantillas (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      idcampeonato INT NOT NULL,
      archivo VARCHAR(255) NOT NULL,
      nombre_original VARCHAR(255) NOT NULL,
      tamano BIGINT UNSIGNED NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_plantillas_campeonato (idcampeonato)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

const removeFile = async filePath => {
  if (!filePath) return;
  const relativePath = String(filePath).replace(/^[/\\]+/, '');
  const resolvedPath = path.resolve(publicDir, relativePath);
  const templateRoot = path.resolve(publicDir, 'media', 'plantillas');
  if (!resolvedPath.startsWith(`${templateRoot}${path.sep}`)) return;
  await fs.unlink(resolvedPath).catch(error => {
    if (error.code !== 'ENOENT') throw error;
  });
};

const removeUploadedFile = file => file?.path
  ? fs.unlink(file.path).catch(error => { if (error.code !== 'ENOENT') throw error; })
  : Promise.resolve();

const sanitizeFilenamePart = value => String(value || '')
  .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const getAll = async (req, res, next) => {
  try {
    await ensureTemplateTable();
    const params = [];
    const where = req.query.idcampeonato ? 'WHERE pl.idcampeonato = ?' : '';
    if (req.query.idcampeonato) params.push(req.query.idcampeonato);
    const [rows] = await pool.query(
      `SELECT pl.id, pl.idcampeonato, pl.archivo, pl.nombre_original, pl.tamano,
              pl.created_at, pl.updated_at, c.temporada, c.anio,
              cat.categoria, cat.logo AS categoria_logo
       FROM plantillas pl
       JOIN campeonatos c ON c.id = pl.idcampeonato
       JOIN categorias cat ON cat.id = c.idcategoria
       ${where}
       ORDER BY c.anio DESC, c.temporada DESC, pl.updated_at DESC`,
      params
    );
    res.json({ data: rows, total: rows.length });
  } catch (error) {
    next(error);
  }
};

const download = async (req, res, next) => {
  try {
    await ensureTemplateTable();
    const [[template]] = await pool.query(
      `SELECT pl.archivo, c.temporada, c.anio, cat.categoria
       FROM plantillas pl
       JOIN campeonatos c ON c.id = pl.idcampeonato
       JOIN categorias cat ON cat.id = c.idcategoria
       WHERE pl.id = ? LIMIT 1`,
      [req.params.id]
    );
    if (!template) return res.status(404).json({ error: 'Plantilla no encontrada' });

    const relativePath = String(template.archivo || '').replace(/^[/\\]+/, '');
    const resolvedPath = path.resolve(publicDir, relativePath);
    const templateRoot = path.resolve(publicDir, 'media', 'plantillas');
    if (!resolvedPath.startsWith(`${templateRoot}${path.sep}`)) {
      return res.status(400).json({ error: 'Ruta de la plantilla inválida' });
    }
    const filename = [
      'Plantilla',
      template.categoria,
      `Temporada ${template.temporada}`,
      template.anio,
    ].map(sanitizeFilenamePart).filter(Boolean).join(' - ');
    return res.download(resolvedPath, `${filename}.zip`, error => {
      if (error && !res.headersSent) next(error);
    });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    await ensureTemplateTable();
    const championshipId = Number(req.body.idcampeonato);
    if (!req.file) return res.status(400).json({ error: 'Seleccioná el archivo ZIP de la plantilla' });
    if (!Number.isInteger(championshipId) || championshipId < 1) {
      await removeUploadedFile(req.file);
      return res.status(400).json({ error: 'Seleccioná un campeonato válido' });
    }
    const [[championship]] = await pool.query('SELECT id FROM campeonatos WHERE id = ? LIMIT 1', [championshipId]);
    if (!championship) {
      await removeUploadedFile(req.file);
      return res.status(404).json({ error: 'Campeonato no encontrado' });
    }

    const [[previous]] = await pool.query('SELECT id, archivo FROM plantillas WHERE idcampeonato = ? LIMIT 1', [championshipId]);
    const publicPath = `/media/plantillas/${req.file.filename}`;
    await pool.query(
      `INSERT INTO plantillas (idcampeonato, archivo, nombre_original, tamano)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE archivo = VALUES(archivo), nombre_original = VALUES(nombre_original),
         tamano = VALUES(tamano), updated_at = CURRENT_TIMESTAMP`,
      [championshipId, publicPath, req.file.originalname.slice(0, 255), req.file.size]
    );
    if (previous?.archivo && previous.archivo !== publicPath) await removeFile(previous.archivo);
    const [[saved]] = await pool.query('SELECT id FROM plantillas WHERE idcampeonato = ? LIMIT 1', [championshipId]);
    res.status(previous ? 200 : 201).json({
      data: { id: saved.id, idcampeonato: championshipId, archivo: publicPath },
      message: previous ? 'Plantilla reemplazada correctamente' : 'Plantilla publicada correctamente',
    });
  } catch (error) {
    await removeUploadedFile(req.file).catch(() => {});
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await ensureTemplateTable();
    const [[template]] = await pool.query('SELECT archivo FROM plantillas WHERE id = ?', [req.params.id]);
    if (!template) return res.status(404).json({ error: 'Plantilla no encontrada' });
    await pool.query('DELETE FROM plantillas WHERE id = ?', [req.params.id]);
    await removeFile(template.archivo);
    res.json({ message: 'Plantilla eliminada correctamente' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAll, download, create, remove };
