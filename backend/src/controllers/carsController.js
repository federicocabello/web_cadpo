const pool = require('../config/db');

const toPublicImagePath = file => {
  if (!file) return '';
  return `/media/autos/imagenes/${file.filename}`;
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
      `SELECT a.id, a.idcategoria, a.marca AS idmarca, am.marca, am.logo,
              a.modelo, a.imagen, cat.categoria
       FROM autos a
       JOIN autos_marcas am ON a.marca = am.id
       JOIN categorias cat ON a.idcategoria = cat.id
       ORDER BY cat.categoria ASC, am.marca ASC, a.modelo ASC`
    );
    res.json({ data: rows, total: rows.length });
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const [[row]] = await pool.query(
      `SELECT a.id, a.idcategoria, a.marca AS idmarca, am.marca, am.logo,
              a.modelo, a.imagen, cat.categoria
       FROM autos a
       JOIN autos_marcas am ON a.marca = am.id
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
    const marca = Number(req.body.marca);
    const modelo = capitalizeValue(req.body.modelo);

    if (!idcategoria || !marca || !modelo) {
      return res.status(400).json({ error: 'idcategoria, marca y modelo son requeridos' });
    }

    const imagen = toPublicImagePath(getUploadedFile(req.files, 'imagen'));
    const [result] = await pool.query(
      'INSERT INTO autos (idcategoria, marca, modelo, imagen) VALUES (?, ?, ?, ?)',
      [idcategoria, marca, modelo, imagen]
    );

    res.status(201).json({
      data: { id: result.insertId, idcategoria, idmarca: marca, modelo, imagen },
      message: 'Auto agregado',
    });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const idcategoria = req.body.idcategoria;
    const marca = Number(req.body.marca);
    const modelo = capitalizeValue(req.body.modelo);

    if (!idcategoria || !marca || !modelo) {
      return res.status(400).json({ error: 'idcategoria, marca y modelo son requeridos' });
    }

    const [[current]] = await pool.query('SELECT imagen FROM autos WHERE id = ?', [req.params.id]);
    if (!current) return res.status(404).json({ error: 'Auto no encontrado' });

    const imageFile = getUploadedFile(req.files, 'imagen');
    const imagen = imageFile ? toPublicImagePath(imageFile) : current.imagen;
    const [result] = await pool.query(
      'UPDATE autos SET idcategoria=?, marca=?, modelo=?, imagen=? WHERE id=?',
      [idcategoria, marca, modelo, imagen || '', req.params.id]
    );

    if (!result.affectedRows) return res.status(404).json({ error: 'Auto no encontrado' });

    res.json({
      message: 'Auto actualizado',
      data: { id: req.params.id, idcategoria, idmarca: marca, modelo, imagen },
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
