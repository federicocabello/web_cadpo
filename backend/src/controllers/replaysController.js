const fs = require('fs/promises');
const path = require('path');
const pool = require('../config/db');
const publicDir = require('../utils/publicDir');

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

const create = async (req, res, next) => {
  try {
    await ensureReplayTable();
    const championshipId = Number(req.body.idcampeonato);
    const round = Number(req.body.ronda);
    const session = String(req.body.tanda || '').trim().slice(0, 80);
    if (!req.file) return res.status(400).json({ error: 'Seleccioná un archivo de replay' });
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
      message: 'Replay publicado correctamente',
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
    if (!replay) return res.status(404).json({ error: 'Replay no encontrado' });
    await pool.query('DELETE FROM replays WHERE id = ?', [req.params.id]);
    const relativePath = String(replay.archivo || '').replace(/^[/\\]+/, '');
    const resolvedPath = path.resolve(publicDir, relativePath);
    const replayRoot = path.resolve(publicDir, 'media', 'replays');
    if (resolvedPath.startsWith(`${replayRoot}${path.sep}`)) {
      await fs.unlink(resolvedPath).catch(error => {
        if (error.code !== 'ENOENT') throw error;
      });
    }
    res.json({ message: 'Replay eliminado correctamente' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAll, create, remove };
