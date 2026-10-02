const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const pool = require('../config/db');
const publicDir = require('../utils/publicDir');

const replayDir = path.join(publicDir, 'media', 'replays');
const chunkUploadDir = path.resolve(__dirname, '../../tmp/replay-uploads');
const allowedExtensions = new Set(['.vcr', '.rpl', '.replay', '.acreplay', '.zip', '.rar', '.7z']);
const uploadIdPattern = /^[a-f0-9]{40}$/;
const chunkMetadataPath = uploadId => path.join(chunkUploadDir, `${uploadId}.json`);
const chunkPartPath = uploadId => path.join(chunkUploadDir, `${uploadId}.part`);

const validateReplayTarget = async (championshipId, round, session) => {
  if (!Number.isInteger(championshipId) || championshipId < 1 || !Number.isInteger(round) || round < 1 || !session) {
    throw Object.assign(new Error('Seleccioná el campeonato, la fecha y la tanda'), { statusCode: 400 });
  }
  const [[event]] = await pool.query(
    'SELECT ronda FROM calendario WHERE idcampeonato = ? AND ronda = ? LIMIT 1',
    [championshipId, round]
  );
  if (!event) throw Object.assign(new Error('La fecha seleccionada no pertenece al campeonato'), { statusCode: 400 });
};

const readChunkMetadata = async uploadId => {
  if (!uploadIdPattern.test(String(uploadId || ''))) {
    throw Object.assign(new Error('Identificador de subida inválido'), { statusCode: 400 });
  }
  try {
    return JSON.parse(await fs.readFile(chunkMetadataPath(uploadId), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') throw Object.assign(new Error('La subida venció o no existe. Volvé a iniciarla.'), { statusCode: 404 });
    throw error;
  }
};

const cleanupStaleChunkUploads = async () => {
  await fs.mkdir(chunkUploadDir, { recursive: true });
  const entries = await fs.readdir(chunkUploadDir, { withFileTypes: true });
  const cutoff = Date.now() - (24 * 60 * 60 * 1000);
  await Promise.all(entries.filter(entry => entry.isFile()).map(async entry => {
    const target = path.join(chunkUploadDir, entry.name);
    const stat = await fs.stat(target).catch(() => null);
    if (stat && stat.mtimeMs < cutoff) await fs.unlink(target).catch(() => {});
  }));
};

const moveUploadedReplay = async (source, destination) => {
  try {
    await fs.rename(source, destination);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
    await fs.copyFile(source, destination);
    await fs.unlink(source);
  }
};

const ensureReplayTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS replays (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      idcampeonato INT NOT NULL,
      ronda SMALLINT UNSIGNED NOT NULL,
      tanda VARCHAR(80) NOT NULL,
      archivo VARCHAR(255) NOT NULL,
      nombre_original VARCHAR(255) NOT NULL,
      tamano BIGINT UNSIGNED NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_replays_campeonato_ronda (idcampeonato, ronda)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

const removeUploadedFile = async file => {
  if (!file?.path) return;
  await fs.unlink(file.path).catch(error => {
    if (error.code !== 'ENOENT') throw error;
  });
};

const sanitizeFilenamePart = value => String(value || '')
  .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const download = async (req, res, next) => {
  try {
    await ensureReplayTable();
    const [[replay]] = await pool.query(
      `SELECT rp.archivo, rp.nombre_original, rp.ronda, rp.tanda,
              cat.categoria, ci.nombre AS circuito, ci.variante
       FROM replays rp
       JOIN campeonatos c ON c.id = rp.idcampeonato
       JOIN categorias cat ON cat.id = c.idcategoria
       LEFT JOIN calendario cal ON cal.idcampeonato = rp.idcampeonato AND cal.ronda = rp.ronda
       LEFT JOIN circuitos ci ON ci.id = cal.idcircuito
       WHERE rp.id = ?
       LIMIT 1`,
      [req.params.id]
    );
    if (!replay) return res.status(404).json({ error: 'Repetición no encontrada' });

    const relativePath = String(replay.archivo || '').replace(/^[/\\]+/, '');
    const resolvedPath = path.resolve(publicDir, relativePath);
    const replayRoot = path.resolve(publicDir, 'media', 'replays');
    if (!resolvedPath.startsWith(`${replayRoot}${path.sep}`)) {
      return res.status(400).json({ error: 'Ruta de la repetición inválida' });
    }

    const extension = path.extname(replay.nombre_original || replay.archivo || '');
    const circuit = [replay.circuito, replay.variante].filter(Boolean).join(' ');
    const filenameParts = [
      replay.categoria,
      `Fecha ${replay.ronda}`,
      replay.tanda,
      circuit || 'Circuito',
    ].map(sanitizeFilenamePart).filter(Boolean);
    const downloadName = `${filenameParts.join(' - ')}${extension}`;

    return res.download(resolvedPath, downloadName, error => {
      if (error && !res.headersSent) next(error);
    });
  } catch (error) {
    next(error);
  }
};

const getAll = async (req, res, next) => {
  try {
    await ensureReplayTable();
    const conditions = [];
    const params = [];
    if (req.query.idcampeonato) {
      conditions.push('rp.idcampeonato = ?');
      params.push(req.query.idcampeonato);
    }
    if (req.query.ronda) {
      conditions.push('rp.ronda = ?');
      params.push(req.query.ronda);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT rp.id, rp.idcampeonato, rp.ronda, rp.tanda, rp.archivo,
              rp.nombre_original, rp.tamano, rp.created_at,
              c.temporada, c.anio, cat.categoria, cat.logo AS categoria_logo,
              cal.fecha, ci.nombre AS circuito, ci.variante
       FROM replays rp
       JOIN campeonatos c ON c.id = rp.idcampeonato
       JOIN categorias cat ON cat.id = c.idcategoria
       LEFT JOIN calendario cal ON cal.idcampeonato = rp.idcampeonato AND cal.ronda = rp.ronda
       LEFT JOIN circuitos ci ON ci.id = cal.idcircuito
       ${where}
       ORDER BY COALESCE(cal.fecha, rp.created_at) DESC, rp.ronda DESC, rp.tanda ASC, rp.id DESC`,
      params
    );
    res.json({ data: rows, total: rows.length });
  } catch (error) {
    next(error);
  }
};

const initChunkedUpload = async (req, res, next) => {
  try {
    await ensureReplayTable();
    await cleanupStaleChunkUploads();
    const championshipId = Number(req.body.idcampeonato);
    const round = Number(req.body.ronda);
    const session = String(req.body.tanda || '').trim().slice(0, 80);
    const originalName = path.basename(String(req.body.nombre_original || '')).slice(0, 255);
    const expectedSize = Number(req.body.tamano);
    const totalChunks = Number(req.body.total_chunks);
    const chunkSize = Number(req.body.chunk_size);
    const extension = path.extname(originalName).toLowerCase();

    await validateReplayTarget(championshipId, round, session);
    if (!originalName || !allowedExtensions.has(extension)) {
      return res.status(400).json({ error: 'Formato de repetición no permitido. Usá VCR, RPL, REPLAY, ACREPLAY, ZIP, RAR o 7Z.' });
    }
    if (!Number.isSafeInteger(expectedSize) || expectedSize < 1
      || !Number.isInteger(totalChunks) || totalChunks < 1 || totalChunks > 100000
      || !Number.isInteger(chunkSize) || chunkSize < 1024 || chunkSize > 8 * 1024 * 1024
      || Math.ceil(expectedSize / chunkSize) !== totalChunks) {
      return res.status(400).json({ error: 'Los datos del archivo de repetición no son válidos' });
    }

    const uploadId = crypto.randomBytes(20).toString('hex');
    const storedFilename = `${Date.now()}-${crypto.randomBytes(10).toString('hex')}${extension}`;
    const metadata = {
      uploadId, championshipId, round, session, originalName, expectedSize,
      totalChunks, chunkSize, nextChunk: 0, receivedBytes: 0, storedFilename,
      createdAt: new Date().toISOString(),
    };
    await fs.writeFile(chunkPartPath(uploadId), Buffer.alloc(0), { flag: 'wx' });
    await fs.writeFile(chunkMetadataPath(uploadId), JSON.stringify(metadata), { flag: 'wx' });
    res.status(201).json({ data: { uploadId, totalChunks, chunkSize } });
  } catch (error) { next(error); }
};

const uploadChunk = async (req, res, next) => {
  try {
    if (!req.file?.buffer?.length) return res.status(400).json({ error: 'El bloque recibido está vacío' });
    const metadata = await readChunkMetadata(req.params.uploadId);
    const index = Number(req.body.index);
    if (!Number.isInteger(index) || index < 0 || index >= metadata.totalChunks) {
      return res.status(400).json({ error: 'Número de bloque inválido' });
    }
    if (index < metadata.nextChunk) {
      return res.json({ data: { nextChunk: metadata.nextChunk, receivedBytes: metadata.receivedBytes } });
    }
    if (index !== metadata.nextChunk) {
      return res.status(409).json({ error: `Se esperaba el bloque ${metadata.nextChunk + 1}` });
    }
    const expectedChunkBytes = index === metadata.totalChunks - 1
      ? metadata.expectedSize - (index * metadata.chunkSize)
      : metadata.chunkSize;
    if (req.file.buffer.length !== expectedChunkBytes) {
      return res.status(400).json({ error: 'El bloque recibido tiene un tamaño incorrecto' });
    }

    const handle = await fs.open(chunkPartPath(metadata.uploadId), 'r+');
    try {
      let written = 0;
      while (written < req.file.buffer.length) {
        const result = await handle.write(
          req.file.buffer,
          written,
          req.file.buffer.length - written,
          (index * metadata.chunkSize) + written,
        );
        written += result.bytesWritten;
      }
    } finally {
      await handle.close();
    }
    metadata.nextChunk += 1;
    metadata.receivedBytes += req.file.buffer.length;
    await fs.writeFile(chunkMetadataPath(metadata.uploadId), JSON.stringify(metadata));
    res.json({ data: { nextChunk: metadata.nextChunk, receivedBytes: metadata.receivedBytes } });
  } catch (error) { next(error); }
};

const completeChunkedUpload = async (req, res, next) => {
  let finalPath = '';
  try {
    await ensureReplayTable();
    const metadata = await readChunkMetadata(req.params.uploadId);
    const partPath = chunkPartPath(metadata.uploadId);
    const stat = await fs.stat(partPath);
    if (metadata.nextChunk !== metadata.totalChunks || metadata.receivedBytes !== metadata.expectedSize || stat.size !== metadata.expectedSize) {
      return res.status(409).json({ error: 'La repetición todavía no terminó de subirse' });
    }
    await validateReplayTarget(metadata.championshipId, metadata.round, metadata.session);
    await fs.mkdir(replayDir, { recursive: true });
    finalPath = path.join(replayDir, metadata.storedFilename);
    await moveUploadedReplay(partPath, finalPath);
    const publicPath = `/media/replays/${metadata.storedFilename}`;
    const [result] = await pool.query(
      `INSERT INTO replays (idcampeonato, ronda, tanda, archivo, nombre_original, tamano)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [metadata.championshipId, metadata.round, metadata.session, publicPath, metadata.originalName, metadata.expectedSize]
    );
    await fs.unlink(chunkMetadataPath(metadata.uploadId)).catch(() => {});
    res.status(201).json({
      data: { id: result.insertId, idcampeonato: metadata.championshipId, ronda: metadata.round, tanda: metadata.session, archivo: publicPath },
      message: 'Repetición publicada correctamente',
    });
  } catch (error) {
    if (finalPath) await fs.unlink(finalPath).catch(() => {});
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    await ensureReplayTable();
    const championshipId = Number(req.body.idcampeonato);
    const round = Number(req.body.ronda);
    const session = String(req.body.tanda || '').trim().slice(0, 80);
    if (!req.file) return res.status(400).json({ error: 'Seleccioná un archivo de repetición' });
    if (!Number.isInteger(championshipId) || championshipId < 1 || !Number.isInteger(round) || round < 1 || !session) {
      await removeUploadedFile(req.file);
      return res.status(400).json({ error: 'Seleccioná el campeonato, la fecha y la tanda' });
    }

    const [[event]] = await pool.query(
      'SELECT ronda FROM calendario WHERE idcampeonato = ? AND ronda = ? LIMIT 1',
      [championshipId, round]
    );
    if (!event) {
      await removeUploadedFile(req.file);
      return res.status(400).json({ error: 'La fecha seleccionada no pertenece al campeonato' });
    }

    const publicPath = `/media/replays/${req.file.filename}`;
    const [result] = await pool.query(
      `INSERT INTO replays (idcampeonato, ronda, tanda, archivo, nombre_original, tamano)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [championshipId, round, session, publicPath, req.file.originalname.slice(0, 255), req.file.size]
    );
    res.status(201).json({
      data: { id: result.insertId, idcampeonato: championshipId, ronda: round, tanda: session, archivo: publicPath },
      message: 'Repetición publicada correctamente',
    });
  } catch (error) {
    await removeUploadedFile(req.file).catch(() => {});
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await ensureReplayTable();
    const [[replay]] = await pool.query('SELECT archivo FROM replays WHERE id = ?', [req.params.id]);
    if (!replay) return res.status(404).json({ error: 'Repetición no encontrada' });
    await pool.query('DELETE FROM replays WHERE id = ?', [req.params.id]);
    const relativePath = String(replay.archivo || '').replace(/^[/\\]+/, '');
    const resolvedPath = path.resolve(publicDir, relativePath);
    const replayRoot = path.resolve(publicDir, 'media', 'replays');
    if (resolvedPath.startsWith(`${replayRoot}${path.sep}`)) {
      await fs.unlink(resolvedPath).catch(error => {
        if (error.code !== 'ENOENT') throw error;
      });
    }
    res.json({ message: 'Repetición eliminada correctamente' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAll, download, initChunkedUpload, uploadChunk, completeChunkedUpload, create, remove };
