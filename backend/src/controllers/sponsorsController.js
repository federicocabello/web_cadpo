const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const pool = require('../config/db');
const publicDir = require('../utils/publicDir');

const sponsorsRoot = path.join(publicDir, 'media', 'sponsors');
let schemaPromise;

const ensureSchema = () => {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS sponsors (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          empresa VARCHAR(160) NOT NULL,
          logo VARCHAR(500) NOT NULL DEFAULT '',
          descripcion TEXT NULL,
          direccion VARCHAR(500) NOT NULL DEFAULT '',
          activo TINYINT(1) NOT NULL DEFAULT 1,
          creado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          actualizado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS sponsor_fotos (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          idsponsor INT UNSIGNED NOT NULL,
          imagen VARCHAR(500) NOT NULL,
          orden INT NOT NULL DEFAULT 0,
          creado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_sponsor_fotos_sponsor (idsponsor)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      const additionalColumns = [
        ['contacto', "VARCHAR(255) NOT NULL DEFAULT '' AFTER direccion"],
        ['sitio', "VARCHAR(500) NOT NULL DEFAULT '' AFTER contacto"],
      ];
      for (const [column, definition] of additionalColumns) {
        const [columns] = await pool.query(`SHOW COLUMNS FROM sponsors LIKE '${column}'`);
        if (!columns.length) await pool.query(`ALTER TABLE sponsors ADD COLUMN ${column} ${definition}`);
      }
    })().catch(error => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
};

const normalizeText = value => String(value || '').trim();
const sponsorDirectory = id => path.join(sponsorsRoot, String(Number(id)));
const sponsorPublicPath = id => `/media/sponsors/${Number(id)}`;

const writeImage = async (id, file, prefix) => {
  const extension = path.extname(file.originalname).toLowerCase();
  const filename = `${prefix}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`;
  const directory = sponsorDirectory(id);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, filename), file.buffer);
  return `${sponsorPublicPath(id)}/${filename}`;
};

const removePublicImage = async value => {
  const filename = path.basename(String(value || ''));
  const sponsorId = String(value || '').match(/^\/media\/sponsors\/(\d+)\//)?.[1];
  if (!filename || !sponsorId) return;
  try {
    await fs.unlink(path.join(sponsorDirectory(sponsorId), filename));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
};

const loadSponsors = async ({ includeInactive = false } = {}) => {
  await ensureSchema();
  const [sponsors] = await pool.query(`
    SELECT id, empresa, logo, descripcion, direccion, direccion AS ubicacion,
           contacto, sitio, activo, creado, actualizado
    FROM sponsors
    ${includeInactive ? '' : 'WHERE activo = 1'}
    ORDER BY empresa ASC, id ASC
  `);
  if (!sponsors.length) return [];
  const [photos] = await pool.query(`
    SELECT id, idsponsor, imagen, orden
    FROM sponsor_fotos
    WHERE idsponsor IN (?)
    ORDER BY orden ASC, id ASC
  `, [sponsors.map(sponsor => sponsor.id)]);
  const photosBySponsor = photos.reduce((groups, photo) => {
    const key = String(photo.idsponsor);
    if (!groups[key]) groups[key] = [];
    groups[key].push(photo);
    return groups;
  }, {});
  return sponsors.map(sponsor => ({
    ...sponsor,
    activo: Boolean(sponsor.activo),
    fotos: photosBySponsor[String(sponsor.id)] || [],
  }));
};

const getPublic = async (req, res, next) => {
  try {
    const data = await loadSponsors();
    res.json({ data, total: data.length });
  } catch (error) { next(error); }
};

const getAdmin = async (req, res, next) => {
  try {
    const data = await loadSponsors({ includeInactive: true });
    res.json({ data, total: data.length });
  } catch (error) { next(error); }
};

const create = async (req, res, next) => {
  try {
    await ensureSchema();
    const empresa = normalizeText(req.body.empresa);
    if (!empresa) return res.status(400).json({ error: 'La empresa es requerida' });
    const descripcion = normalizeText(req.body.descripcion);
    const ubicacion = normalizeText(req.body.ubicacion ?? req.body.direccion);
    const contacto = normalizeText(req.body.contacto);
    const sitio = normalizeText(req.body.sitio);
    const activo = req.body.activo === 'false' || req.body.activo === '0' ? 0 : 1;
    const [result] = await pool.query(
      'INSERT INTO sponsors (empresa, descripcion, direccion, contacto, sitio, activo) VALUES (?, ?, ?, ?, ?, ?)',
      [empresa, descripcion, ubicacion, contacto, sitio, activo],
    );
    const id = result.insertId;
    const logoFile = req.files?.logo?.[0];
    const galleryFiles = req.files?.fotos || [];
    const logo = logoFile ? await writeImage(id, logoFile, 'logo') : '';
    if (logo) await pool.query('UPDATE sponsors SET logo = ? WHERE id = ?', [logo, id]);
    for (let index = 0; index < galleryFiles.length; index += 1) {
      const imagen = await writeImage(id, galleryFiles[index], 'foto');
      await pool.query('INSERT INTO sponsor_fotos (idsponsor, imagen, orden) VALUES (?, ?, ?)', [id, imagen, index]);
    }
    const data = (await loadSponsors({ includeInactive: true })).find(sponsor => Number(sponsor.id) === Number(id));
    res.status(201).json({ data, message: 'Sponsor creado correctamente' });
  } catch (error) { next(error); }
};

const update = async (req, res, next) => {
  try {
    await ensureSchema();
    const [[current]] = await pool.query('SELECT * FROM sponsors WHERE id = ?', [req.params.id]);
    if (!current) return res.status(404).json({ error: 'Sponsor no encontrado' });
    const empresa = normalizeText(req.body.empresa);
    if (!empresa) return res.status(400).json({ error: 'La empresa es requerida' });
    const descripcion = normalizeText(req.body.descripcion);
    const ubicacion = normalizeText(req.body.ubicacion ?? req.body.direccion);
    const contacto = normalizeText(req.body.contacto);
    const sitio = normalizeText(req.body.sitio);
    const activo = req.body.activo === 'true' || req.body.activo === '1' ? 1 : 0;
    const logoFile = req.files?.logo?.[0];
    let logo = current.logo;
    if (logoFile) {
      logo = await writeImage(req.params.id, logoFile, 'logo');
      await removePublicImage(current.logo);
    }
    await pool.query(
      'UPDATE sponsors SET empresa = ?, logo = ?, descripcion = ?, direccion = ?, contacto = ?, sitio = ?, activo = ? WHERE id = ?',
      [empresa, logo, descripcion, ubicacion, contacto, sitio, activo, req.params.id],
    );
    const galleryFiles = req.files?.fotos || [];
    const [[lastOrder]] = await pool.query('SELECT COALESCE(MAX(orden), -1) AS orden FROM sponsor_fotos WHERE idsponsor = ?', [req.params.id]);
    for (let index = 0; index < galleryFiles.length; index += 1) {
      const imagen = await writeImage(req.params.id, galleryFiles[index], 'foto');
      await pool.query('INSERT INTO sponsor_fotos (idsponsor, imagen, orden) VALUES (?, ?, ?)', [req.params.id, imagen, Number(lastOrder.orden) + index + 1]);
    }
    const data = (await loadSponsors({ includeInactive: true })).find(sponsor => Number(sponsor.id) === Number(req.params.id));
    res.json({ data, message: 'Sponsor actualizado correctamente' });
  } catch (error) { next(error); }
};

const removePhoto = async (req, res, next) => {
  try {
    await ensureSchema();
    const [[photo]] = await pool.query('SELECT id, imagen FROM sponsor_fotos WHERE id = ? AND idsponsor = ?', [req.params.photoId, req.params.id]);
    if (!photo) return res.status(404).json({ error: 'Foto no encontrada' });
    await pool.query('DELETE FROM sponsor_fotos WHERE id = ? AND idsponsor = ?', [req.params.photoId, req.params.id]);
    await removePublicImage(photo.imagen);
    res.json({ message: 'Foto eliminada' });
  } catch (error) { next(error); }
};

const remove = async (req, res, next) => {
  try {
    await ensureSchema();
    const [[sponsor]] = await pool.query('SELECT id FROM sponsors WHERE id = ?', [req.params.id]);
    if (!sponsor) return res.status(404).json({ error: 'Sponsor no encontrado' });
    await pool.query('DELETE FROM sponsor_fotos WHERE idsponsor = ?', [req.params.id]);
    await pool.query('DELETE FROM sponsors WHERE id = ?', [req.params.id]);
    try {
      await fs.rm(sponsorDirectory(req.params.id), { recursive: true, force: true });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    res.json({ message: 'Sponsor eliminado' });
  } catch (error) { next(error); }
};

module.exports = { create, getAdmin, getPublic, remove, removePhoto, update };
