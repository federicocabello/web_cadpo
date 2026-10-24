const fs = require('fs/promises');
const path = require('path');
const archiver = require('archiver');
const pool = require('../config/db');
const publicDir = require('../utils/publicDir');
const uploadPaintFiles = require('../middleware/uploadPaintFiles');

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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pinturas_config (
      idcampeonato INT NOT NULL,
      cargas_habilitadas TINYINT(1) NOT NULL DEFAULT 0,
      fecha_cierre DATETIME NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (idcampeonato)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  const [paintConfigDeadlineColumns] = await pool.query("SHOW COLUMNS FROM pinturas_config LIKE 'fecha_cierre'");
  if (!paintConfigDeadlineColumns.length) {
    await pool.query('ALTER TABLE pinturas_config ADD COLUMN fecha_cierre DATETIME NULL AFTER cargas_habilitadas')
      .catch(error => { if (error.code !== 'ER_DUP_FIELDNAME') throw error; });
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pinturas_archivos (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      idcampeonato INT NOT NULL,
      idpiloto INT NOT NULL,
      archivo VARCHAR(255) NOT NULL,
      nombre_original VARCHAR(255) NOT NULL,
      extension VARCHAR(10) NOT NULL,
      tamano BIGINT UNSIGNED NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_pinturas_campeonato (idcampeonato),
      KEY idx_pinturas_piloto (idpiloto)
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

const removeUploadedFiles = files => Promise.all((files || []).map(removeUploadedFile));

const resolvePaintFile = filename => {
  const safeName = path.basename(String(filename || ''));
  const resolvedPath = path.resolve(uploadPaintFiles.paintDir, safeName);
  if (!safeName || !resolvedPath.startsWith(`${path.resolve(uploadPaintFiles.paintDir)}${path.sep}`)) return '';
  return resolvedPath;
};

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

const getChampionships = async (req, res, next) => {
  try {
    await ensureTemplateTable();
    const [rows] = await pool.query(
      `SELECT c.id AS idcampeonato, c.temporada, c.anio, cat.categoria, cat.logo AS categoria_logo,
              pl.id AS plantilla_id, pl.nombre_original AS plantilla_nombre, pl.tamano AS plantilla_tamano,
              COALESCE(pc.cargas_habilitadas, 0) AS cargas_habilitadas, pc.fecha_cierre,
              CASE WHEN pc.fecha_cierre IS NOT NULL AND pc.fecha_cierre > NOW()
                   THEN 1 ELSE 0 END AS entrega_abierta
       FROM campeonatos c
       JOIN categorias cat ON cat.id = c.idcategoria
       LEFT JOIN plantillas pl ON pl.idcampeonato = c.id
       LEFT JOIN pinturas_config pc ON pc.idcampeonato = c.id
       ORDER BY c.id DESC`
    );
    res.json({
      data: rows.map(row => ({
        ...row,
        cargas_habilitadas: Boolean(row.cargas_habilitadas),
        entrega_abierta: Boolean(row.entrega_abierta),
      })),
      total: rows.length,
    });
  } catch (error) {
    next(error);
  }
};

const getEnrolledDrivers = async (req, res, next) => {
  try {
    await ensureTemplateTable();
    const championshipId = Number(req.params.idcampeonato);
    if (!Number.isInteger(championshipId) || championshipId < 1) return res.status(400).json({ error: 'Campeonato inválido' });
    const [[config]] = await pool.query(
      `SELECT cargas_habilitadas, fecha_cierre,
              CASE WHEN fecha_cierre IS NOT NULL AND fecha_cierre > NOW() THEN 1 ELSE 0 END AS entrega_abierta
       FROM pinturas_config WHERE idcampeonato = ? LIMIT 1`,
      [championshipId]
    );
    if (!config?.entrega_abierta) return res.json({ data: [], total: 0, enabled: false, fecha_cierre: config?.fecha_cierre || null });
    const [rows] = await pool.query(
      `SELECT p.id, p.nombre, i.numero, i.pago
       FROM inscriptos i
       JOIN pilotos p ON p.id = i.idpiloto
       WHERE i.idcampeonato = ?
       ORDER BY p.nombre ASC`,
      [championshipId]
    );
    res.json({ data: rows, total: rows.length, enabled: true });
  } catch (error) {
    next(error);
  }
};

const uploadPaintings = async (req, res, next) => {
    const files = Array.isArray(req.files) ? req.files : [];
  try {
    await ensureTemplateTable();
    const championshipId = Number(req.body.idcampeonato);
    const driverId = Number(req.body.idpiloto);
    if (!Number.isInteger(championshipId) || championshipId < 1 || !Number.isInteger(driverId) || driverId < 1) {
      await removeUploadedFiles(files);
      return res.status(400).json({ error: 'Seleccioná un campeonato y un piloto válidos' });
    }
    if (!files.length) return res.status(400).json({ error: 'Seleccioná al menos un archivo DDS, PNG o JPG' });

    const incomingNames = files.map(file => file.originalname.slice(0, 255));
    const normalizedNames = incomingNames.map(name => name.trim().toLocaleLowerCase('es-AR'));
    const repeatedIncomingName = normalizedNames.find((name, index) => normalizedNames.indexOf(name) !== index);
    if (repeatedIncomingName) {
      await removeUploadedFiles(files);
      return res.status(409).json({ error: 'No podés subir dos archivos con el mismo nombre en una misma entrega' });
    }

    const [[config]] = await pool.query(
      `SELECT cargas_habilitadas, fecha_cierre,
              CASE WHEN fecha_cierre IS NOT NULL AND fecha_cierre > NOW() THEN 1 ELSE 0 END AS entrega_abierta
       FROM pinturas_config WHERE idcampeonato = ? LIMIT 1`,
      [championshipId]
    );
    if (!config?.entrega_abierta) {
      await removeUploadedFiles(files);
      return res.status(403).json({ error: 'La entrega de pinturas está cerrada para este campeonato' });
    }
    const [[registration]] = await pool.query(
      'SELECT idpiloto FROM inscriptos WHERE idcampeonato = ? AND idpiloto = ? LIMIT 1',
      [championshipId, driverId]
    );
    if (!registration) {
      await removeUploadedFiles(files);
      return res.status(403).json({ error: 'El piloto seleccionado no está inscripto en este campeonato' });
    }

    const placeholders = incomingNames.map(() => '?').join(', ');
    const [duplicates] = await pool.query(
      `SELECT nombre_original FROM pinturas_archivos
       WHERE idcampeonato = ? AND idpiloto = ?
         AND LOWER(nombre_original) IN (${placeholders})
       LIMIT 1`,
      [championshipId, driverId, ...normalizedNames]
    );
    if (duplicates.length) {
      await removeUploadedFiles(files);
      return res.status(409).json({ error: `Ya existe un archivo llamado "${duplicates[0].nombre_original}" para este piloto` });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const file of files) {
        await connection.query(
          `INSERT INTO pinturas_archivos
             (idcampeonato, idpiloto, archivo, nombre_original, extension, tamano)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [championshipId, driverId, file.filename, file.originalname.slice(0, 255), path.extname(file.originalname).toLowerCase(), file.size]
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    res.status(201).json({ message: `${files.length} archivo${files.length === 1 ? '' : 's'} enviado${files.length === 1 ? '' : 's'} correctamente` });
  } catch (error) {
    await removeUploadedFiles(files).catch(() => {});
    next(error);
  }
};

const getSubmittedPaintings = async (req, res, next) => {
  try {
    await ensureTemplateTable();
    const championshipId = Number(req.params.idcampeonato);
    const driverId = Number(req.params.idpiloto);
    if (!Number.isInteger(championshipId) || championshipId < 1 || !Number.isInteger(driverId) || driverId < 1) {
      return res.status(400).json({ error: 'Campeonato o piloto inválido' });
    }
    const [rows] = await pool.query(
      `SELECT pa.id, pa.nombre_original, pa.extension, pa.tamano, pa.created_at
       FROM pinturas_archivos pa
       JOIN pinturas_config pc ON pc.idcampeonato = pa.idcampeonato
       WHERE pa.idcampeonato = ? AND pa.idpiloto = ?
         AND pc.fecha_cierre IS NOT NULL AND pc.fecha_cierre > NOW()
       ORDER BY pa.created_at DESC, pa.id DESC`,
      [championshipId, driverId]
    );
    res.json({ data: rows, total: rows.length });
  } catch (error) {
    next(error);
  }
};

const previewSubmittedPainting = async (req, res, next) => {
  try {
    await ensureTemplateTable();
    const [[file]] = await pool.query(
      `SELECT pa.archivo, pa.extension
       FROM pinturas_archivos pa
       JOIN pinturas_config pc ON pc.idcampeonato = pa.idcampeonato
       WHERE pa.id = ? AND pc.fecha_cierre IS NOT NULL AND pc.fecha_cierre > NOW()
       LIMIT 1`,
      [req.params.id]
    );
    if (!file) return res.status(404).json({ error: 'Vista previa no disponible' });
    const extension = String(file.extension || '').toLowerCase();
    if (!['.png', '.jpg', '.jpeg'].includes(extension)) {
      return res.status(415).json({ error: 'Este formato no admite vista previa en el navegador' });
    }
    const resolvedPath = resolvePaintFile(file.archivo);
    if (!resolvedPath) return res.status(400).json({ error: 'Ruta de archivo inválida' });
    res.type(extension === '.png' ? 'png' : 'jpg');
    res.set('Cache-Control', 'private, no-store');
    return res.sendFile(resolvedPath, error => {
      if (error && !res.headersSent) next(error);
    });
  } catch (error) {
    next(error);
  }
};

const getAdminPaintings = async (req, res, next) => {
  try {
    await ensureTemplateTable();
    const params = [];
    const where = req.query.idcampeonato ? 'WHERE pa.idcampeonato = ?' : '';
    if (req.query.idcampeonato) params.push(req.query.idcampeonato);
    const [rows] = await pool.query(
      `SELECT pa.id, pa.idcampeonato, pa.idpiloto, pa.nombre_original, pa.extension, pa.tamano, pa.created_at,
              COALESCE(p.nombre, 'PRUEBA DE DESARROLLO') AS piloto, i.numero,
              am.marca, a.modelo, c.temporada, c.anio, cat.categoria
       FROM pinturas_archivos pa
       LEFT JOIN pilotos p ON p.id = pa.idpiloto
       JOIN campeonatos c ON c.id = pa.idcampeonato
       JOIN categorias cat ON cat.id = c.idcategoria
       LEFT JOIN inscriptos i ON i.idcampeonato = pa.idcampeonato AND i.idpiloto = pa.idpiloto
       LEFT JOIN autos a ON a.id = i.idauto
       LEFT JOIN autos_marcas am ON am.id = a.marca
       ${where}
       ORDER BY pa.created_at DESC, pa.id DESC`,
      params
    );
    res.json({ data: rows, total: rows.length });
  } catch (error) {
    next(error);
  }
};

const downloadPilotPaintingsZip = async (req, res, next) => {
  try {
    await ensureTemplateTable();
    const championshipId = Number(req.params.idcampeonato);
    const driverId = Number(req.params.idpiloto);
    if (!Number.isInteger(championshipId) || championshipId < 1 || !Number.isInteger(driverId) || driverId < 0) {
      return res.status(400).json({ error: 'Campeonato o piloto inválido' });
    }
    const [rows] = await pool.query(
      `SELECT pa.archivo, pa.nombre_original,
              COALESCE(p.nombre, 'Prueba desarrollo') AS piloto,
              COALESCE(i.numero, 0) AS numero, am.marca, a.modelo
       FROM pinturas_archivos pa
       LEFT JOIN pilotos p ON p.id = pa.idpiloto
       LEFT JOIN inscriptos i ON i.idcampeonato = pa.idcampeonato AND i.idpiloto = pa.idpiloto
       LEFT JOIN autos a ON a.id = i.idauto
       LEFT JOIN autos_marcas am ON am.id = a.marca
       WHERE pa.idcampeonato = ? AND pa.idpiloto = ?
       ORDER BY pa.created_at ASC, pa.id ASC`,
      [championshipId, driverId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Este piloto no tiene pinturas entregadas' });

    const availableFiles = [];
    for (const file of rows) {
      const resolvedPath = resolvePaintFile(file.archivo);
      if (!resolvedPath) continue;
      try {
        await fs.access(resolvedPath);
        availableFiles.push({ ...file, resolvedPath });
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    if (!availableFiles.length) return res.status(404).json({ error: 'No se encontraron los archivos físicos de esta entrega' });

    const reference = availableFiles[0];
    const zipName = [reference.piloto, `#${reference.numero}`, reference.marca, reference.modelo]
      .map(sanitizeFilenamePart).filter(Boolean).join(' - ') + '.zip';
    res.attachment(zipName);
    res.type('application/zip');
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', error => {
      if (!res.headersSent) return next(error);
      return res.destroy(error);
    });
    archive.pipe(res);
    availableFiles.forEach(file => archive.file(file.resolvedPath, { name: path.basename(file.nombre_original) }));
    await archive.finalize();
  } catch (error) {
    next(error);
  }
};

const updatePaintingsEnabled = async (req, res, next) => {
  try {
    await ensureTemplateTable();
    const championshipId = Number(req.params.idcampeonato);
    if (!Number.isInteger(championshipId) || championshipId < 1) return res.status(400).json({ error: 'Campeonato inválido' });
    const rawDeadline = String(req.body.fecha_cierre || '').trim();
    const deadline = rawDeadline ? rawDeadline.replace('T', ' ').slice(0, 16) + ':00' : null;
    if (rawDeadline && !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?$/.test(rawDeadline)) {
      return res.status(400).json({ error: 'Ingresá una fecha y hora de cierre válidas' });
    }
    const deadlineIso = rawDeadline ? rawDeadline.replace(' ', 'T').slice(0, 19) : '';
    const deadlineTimestamp = rawDeadline ? new Date(`${deadlineIso.length === 16 ? `${deadlineIso}:00` : deadlineIso}-03:00`).getTime() : Number.NaN;
    if (rawDeadline && !Number.isFinite(deadlineTimestamp)) return res.status(400).json({ error: 'Ingresá una fecha y hora de cierre válidas' });
    if (deadline && deadlineTimestamp <= Date.now()) {
      return res.status(400).json({ error: 'La fecha de cierre debe ser futura para abrir las entregas' });
    }
    const [[championship]] = await pool.query('SELECT id FROM campeonatos WHERE id = ? LIMIT 1', [championshipId]);
    if (!championship) return res.status(404).json({ error: 'Campeonato no encontrado' });
    await pool.query(
      `INSERT INTO pinturas_config (idcampeonato, cargas_habilitadas, fecha_cierre) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE cargas_habilitadas = VALUES(cargas_habilitadas), fecha_cierre = VALUES(fecha_cierre)`,
      [championshipId, deadline ? 1 : 0, deadline]
    );
    const [[saved]] = await pool.query(
      `SELECT idcampeonato, cargas_habilitadas, fecha_cierre,
              CASE WHEN fecha_cierre IS NOT NULL AND fecha_cierre > NOW() THEN 1 ELSE 0 END AS entrega_abierta
       FROM pinturas_config WHERE idcampeonato = ? LIMIT 1`,
      [championshipId]
    );
    res.json({
      data: {
        ...saved,
        cargas_habilitadas: Boolean(saved.cargas_habilitadas),
        entrega_abierta: Boolean(saved.entrega_abierta),
      },
      message: deadline ? 'Fecha de cierre actualizada; la entrega quedó abierta' : 'Fecha eliminada; la entrega quedó cerrada',
    });
  } catch (error) {
    next(error);
  }
};

const downloadPainting = async (req, res, next) => {
  try {
    await ensureTemplateTable();
    const [[file]] = await pool.query(
      `SELECT pa.archivo, pa.nombre_original, COALESCE(p.nombre, 'Prueba desarrollo') AS piloto, c.temporada, cat.categoria
       FROM pinturas_archivos pa
       LEFT JOIN pilotos p ON p.id = pa.idpiloto
       JOIN campeonatos c ON c.id = pa.idcampeonato
       JOIN categorias cat ON cat.id = c.idcategoria
       WHERE pa.id = ? LIMIT 1`,
      [req.params.id]
    );
    if (!file) return res.status(404).json({ error: 'Archivo no encontrado' });
    const resolvedPath = resolvePaintFile(file.archivo);
    if (!resolvedPath) return res.status(400).json({ error: 'Ruta de archivo inválida' });
    const extension = path.extname(file.nombre_original || file.archivo).toLowerCase();
    const filename = [file.categoria, `T${file.temporada}`, file.piloto, path.basename(file.nombre_original, extension)]
      .map(sanitizeFilenamePart).filter(Boolean).join(' - ');
    return res.download(resolvedPath, `${filename}${extension}`, error => {
      if (error && !res.headersSent) next(error);
    });
  } catch (error) {
    next(error);
  }
};

const removePainting = async (req, res, next) => {
  try {
    await ensureTemplateTable();
    const [[file]] = await pool.query('SELECT archivo FROM pinturas_archivos WHERE id = ? LIMIT 1', [req.params.id]);
    if (!file) return res.status(404).json({ error: 'Archivo no encontrado' });
    await pool.query('DELETE FROM pinturas_archivos WHERE id = ?', [req.params.id]);
    const resolvedPath = resolvePaintFile(file.archivo);
    if (resolvedPath) await fs.unlink(resolvedPath).catch(error => { if (error.code !== 'ENOENT') throw error; });
    res.json({ message: 'Archivo de pintura eliminado correctamente' });
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

module.exports = {
  getAll,
  getChampionships,
  getEnrolledDrivers,
  uploadPaintings,
  getSubmittedPaintings,
  previewSubmittedPainting,
  getAdminPaintings,
  downloadPilotPaintingsZip,
  updatePaintingsEnabled,
  downloadPainting,
  removePainting,
  download,
  create,
  remove,
};
