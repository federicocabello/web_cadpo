const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const pool = require('../config/db');
const normalizeCountryCode = require('../utils/countryCode');

const publicDir = require('../utils/publicDir');
let notesSchemaPromise;

const ensureColumn = async (table, column, definition) => {
  const [[row]] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
  `, [table, column]);
  if (!Number(row?.total)) await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
};

const ensureCircuitNotesSchema = () => {
  if (!notesSchemaPromise) {
    notesSchemaPromise = (async () => {
      await ensureColumn('circuitos', 'notas_titulo', 'VARCHAR(180) NULL AFTER `variante`');
      await pool.query(`CREATE TABLE IF NOT EXISTS circuito_notas (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        idcircuito INT UNSIGNED NOT NULL,
        titulo VARCHAR(180) NOT NULL,
        orden SMALLINT UNSIGNED NOT NULL DEFAULT 0,
        creado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_circuito_notas_circuito (idcircuito, orden, id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      await pool.query(`CREATE TABLE IF NOT EXISTS circuito_notas_imagenes (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        idcircuito INT UNSIGNED NOT NULL,
        imagen VARCHAR(500) NOT NULL,
        orden SMALLINT UNSIGNED NOT NULL DEFAULT 0,
        creado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_circuito_notas (idcircuito, orden, id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      await ensureColumn('circuito_notas_imagenes', 'idnota', 'INT UNSIGNED NULL AFTER `idcircuito`');

      const [legacyRows] = await pool.query(`
        SELECT c.id, c.notas_titulo,
               SUM(CASE WHEN img.id IS NOT NULL AND img.idnota IS NULL THEN 1 ELSE 0 END) AS imagenes_pendientes
        FROM circuitos c
        LEFT JOIN circuito_notas_imagenes img ON img.idcircuito = c.id
        GROUP BY c.id, c.notas_titulo
        HAVING COALESCE(TRIM(c.notas_titulo), '') <> ''
           OR SUM(CASE WHEN img.id IS NOT NULL AND img.idnota IS NULL THEN 1 ELSE 0 END) > 0
      `);
      for (const circuit of legacyRows) {
        const [[existingNote]] = await pool.query(
          'SELECT id FROM circuito_notas WHERE idcircuito = ? ORDER BY orden ASC, id ASC LIMIT 1',
          [circuit.id],
        );
        let noteId = existingNote?.id;
        if (!noteId) {
          const title = String(circuit.notas_titulo || 'NOTAS DE PISTA').trim().toLocaleUpperCase('es-AR');
          const [result] = await pool.query(
            'INSERT INTO circuito_notas (idcircuito, titulo, orden) VALUES (?, ?, 0)',
            [circuit.id, title],
          );
          noteId = result.insertId;
        }
        await pool.query(
          'UPDATE circuito_notas_imagenes SET idnota = ? WHERE idcircuito = ? AND idnota IS NULL',
          [noteId, circuit.id],
        );
      }
      await pool.query('UPDATE circuito_notas SET titulo = UPPER(TRIM(titulo))');
      await pool.query("UPDATE circuitos SET notas_titulo = NULL WHERE COALESCE(TRIM(notas_titulo), '') <> ''");
    })().catch(error => {
      notesSchemaPromise = null;
      throw error;
    });
  }
  return notesSchemaPromise;
};

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

const attachCircuitNotes = async rows => {
  const circuitIds = [...new Set((rows || []).map(row => Number(row.idcircuito || row.id)).filter(Number.isInteger))];
  if (!circuitIds.length) return rows || [];
  await ensureCircuitNotesSchema();
  const [notes] = await pool.query(
    'SELECT id, idcircuito, titulo, orden FROM circuito_notas WHERE idcircuito IN (?) ORDER BY orden ASC, id ASC',
    [circuitIds],
  );
  const [images] = await pool.query(
    'SELECT id, idcircuito, idnota, imagen, orden FROM circuito_notas_imagenes WHERE idcircuito IN (?) ORDER BY orden ASC, id ASC',
    [circuitIds],
  );
  const imagesByNote = images.reduce((map, image) => {
    const key = String(image.idnota);
    if (!map[key]) map[key] = [];
    map[key].push({ id: image.id, url: image.imagen, orden: image.orden });
    return map;
  }, {});
  const notesByCircuit = notes.reduce((map, note) => {
    const key = String(note.idcircuito);
    if (!map[key]) map[key] = [];
    map[key].push({
      id: note.id,
      titulo: note.titulo,
      orden: note.orden,
      imagenes: imagesByNote[String(note.id)] || [],
    });
    return map;
  }, {});
  return (rows || []).map(row => {
    const circuitNotes = notesByCircuit[String(row.idcircuito || row.id)] || [];
    return {
      ...row,
      notas_pista: circuitNotes,
      notas_titulo: circuitNotes[0]?.titulo || '',
      notas_imagenes: circuitNotes.flatMap(note => note.imagenes),
    };
  });
};

const deleteNoteFile = async mediaPath => {
  const relativePath = String(mediaPath || '').replace(/^[/\\]+/, '');
  const absolutePath = path.resolve(publicDir, relativePath);
  const notesDir = path.resolve(publicDir, 'media', 'circuitos', 'notas');
  if (!absolutePath.startsWith(`${notesDir}${path.sep}`)) return;
  try { await fs.unlink(absolutePath); } catch (error) {
    if (error.code !== 'ENOENT') console.warn(`No se pudo eliminar ${mediaPath}:`, error.message);
  }
};

const saveNoteImages = async (database, circuitId, noteId, files) => {
  if (!files.length) return;
  const [[row]] = await database.query(
    'SELECT COALESCE(MAX(orden), -1) AS maxOrden FROM circuito_notas_imagenes WHERE idnota = ?',
    [noteId],
  );
  let order = Number(row?.maxOrden ?? -1) + 1;
  for (const file of files) {
    await database.query(
      'INSERT INTO circuito_notas_imagenes (idcircuito, idnota, imagen, orden) VALUES (?, ?, ?, ?)',
      [circuitId, noteId, toPublicImagePath(file, 'notas'), order],
    );
    order += 1;
  }
};

const cloneNoteImage = async mediaPath => {
  const relativePath = String(mediaPath || '').replace(/^[/\\]+/, '');
  const sourcePath = path.resolve(publicDir, relativePath);
  const notesDir = path.resolve(publicDir, 'media', 'circuitos', 'notas');
  if (!sourcePath.startsWith(`${notesDir}${path.sep}`)) throw new Error('Ruta de imagen de nota inválida');
  const extension = path.extname(sourcePath).toLowerCase();
  const filename = `${crypto.randomBytes(16).toString('hex')}${extension}`;
  const destinationPath = path.join(notesDir, filename);
  await fs.mkdir(notesDir, { recursive: true });
  await fs.copyFile(sourcePath, destinationPath);
  return `/media/circuitos/notas/${filename}`;
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
    await ensureCircuitNotesSchema();
    const [rows] = await pool.query(
      `SELECT id, nombre, localidad, provincia, pais, imagen, trazado, variante, notas_titulo
       FROM circuitos
       WHERE UPPER(TRIM(nombre)) <> 'A CONFIRMAR'
       ORDER BY nombre ASC`
    );
    res.json({ data: await attachCircuitNotes(rows), total: rows.length });
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    await ensureCircuitNotesSchema();
    const [[row]] = await pool.query('SELECT * FROM circuitos WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Circuito no encontrado' });

    const [decorated] = await attachCircuitNotes([row]);
    res.json({ data: decorated });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    await ensureCircuitNotesSchema();
    const { nombre, localidad, provincia, pais, variante } = normalizeCircuitFields(req.body);
    if (!nombre) return res.status(400).json({ error: 'nombre es requerido' });

    const imagen = toPublicImagePath(getUploadedFile(req.files, 'imagen'), 'fotos') || normalizeExistingMediaPath(req.body.imagen_actual);
    const trazado = toPublicImagePath(getUploadedFile(req.files, 'trazado'), 'trazados');
    const [result] = await pool.query(
      'INSERT INTO circuitos (nombre, localidad, provincia, pais, imagen, trazado, variante) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [nombre, localidad || '', provincia || '', pais || '', imagen, trazado, variante]
    );

    const [created] = await attachCircuitNotes([{ id: result.insertId, nombre, localidad, provincia, pais, imagen, trazado, variante }]);

    res.status(201).json({
      data: created,
      message: 'Circuito creado',
    });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  const connection = await pool.getConnection();
  let transactionStarted = false;
  let committed = false;
  try {
    await ensureCircuitNotesSchema();
    const { nombre, localidad, provincia, pais, variante } = normalizeCircuitFields(req.body);
    if (!nombre) return res.status(400).json({ error: 'nombre es requerido' });

    const [[current]] = await connection.query('SELECT nombre, imagen, trazado FROM circuitos WHERE id = ?', [req.params.id]);
    if (!current) return res.status(404).json({ error: 'Circuito no encontrado' });

    const imagenFile = getUploadedFile(req.files, 'imagen');
    const trazadoFile = getUploadedFile(req.files, 'trazado');
    const imagen = imagenFile ? toPublicImagePath(imagenFile, 'fotos') : current.imagen;
    const trazado = trazadoFile ? toPublicImagePath(trazadoFile, 'trazados') : current.trazado;
    const nameChanged = String(current.nombre || '').trim().toLocaleLowerCase('es-AR') !== nombre.toLocaleLowerCase('es-AR');

    await connection.beginTransaction();
    transactionStarted = true;
    let renamedVariants = 0;
    if (nameChanged) {
      const [variantsResult] = await connection.query(
        'UPDATE circuitos SET nombre = ? WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(?))',
        [nombre, current.nombre],
      );
      renamedVariants = Number(variantsResult.affectedRows || 0);
    }
    await connection.query(
      'UPDATE circuitos SET nombre=?, localidad=?, provincia=?, pais=?, imagen=?, trazado=?, variante=? WHERE id=?',
      [nombre, localidad || '', provincia || '', pais || '', imagen || '', trazado || '', variante, req.params.id]
    );
    await connection.commit();
    committed = true;

    const cleanupTasks = [];
    if (imagenFile && current.imagen !== imagen) cleanupTasks.push(deleteMediaIfUnused(current.imagen, 'imagen'));
    if (trazadoFile && current.trazado !== trazado) cleanupTasks.push(deleteMediaIfUnused(current.trazado, 'trazado'));

    const cleanupResults = await Promise.allSettled(cleanupTasks);
    cleanupResults
      .filter(result => result.status === 'rejected')
      .forEach(result => console.warn('No se pudo limpiar un archivo anterior:', result.reason?.message));

    const [updated] = await attachCircuitNotes([{ id: Number(req.params.id), nombre, localidad, provincia, pais, imagen, trazado, variante }]);
    res.json({
      message: nameChanged && renamedVariants > 1
        ? `Circuito y ${renamedVariants - 1} variante${renamedVariants === 2 ? '' : 's'} actualizados`
        : 'Circuito actualizado',
      data: updated,
      variantes_actualizadas: nameChanged ? renamedVariants : 0,
    });
  } catch (err) {
    if (transactionStarted && !committed) await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
};

const remove = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await ensureCircuitNotesSchema();
    await connection.beginTransaction();
    const [noteImages] = await connection.query('SELECT imagen FROM circuito_notas_imagenes WHERE idcircuito = ?', [req.params.id]);
    const [result] = await connection.query('DELETE FROM circuitos WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) {
      await connection.rollback();
      return res.status(404).json({ error: 'Circuito no encontrado' });
    }
    await connection.query('DELETE FROM circuito_notas_imagenes WHERE idcircuito = ?', [req.params.id]);
    await connection.query('DELETE FROM circuito_notas WHERE idcircuito = ?', [req.params.id]);
    await connection.commit();

    await Promise.all(noteImages.map(image => deleteNoteFile(image.imagen)));
    res.json({ message: 'Circuito eliminado' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
};

const createNote = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await ensureCircuitNotesSchema();
    const circuitId = Number(req.params.id);
    const title = String(req.body.titulo || '').trim().toLocaleUpperCase('es-AR').slice(0, 180);
    const files = Array.isArray(req.files) ? req.files : [];
    if (!Number.isInteger(circuitId) || circuitId < 1) return res.status(400).json({ error: 'Circuito inválido' });
    if (!title) return res.status(400).json({ error: 'Ingresá un título para la nota de pista' });
    if (!files.length) return res.status(400).json({ error: 'Seleccioná al menos una imagen para la nota' });

    const [[circuit]] = await connection.query('SELECT id FROM circuitos WHERE id = ?', [circuitId]);
    if (!circuit) return res.status(404).json({ error: 'Circuito no encontrado' });
    await connection.beginTransaction();
    const [[orderRow]] = await connection.query(
      'SELECT COALESCE(MAX(orden), -1) + 1 AS siguiente FROM circuito_notas WHERE idcircuito = ?',
      [circuitId],
    );
    const [result] = await connection.query(
      'INSERT INTO circuito_notas (idcircuito, titulo, orden) VALUES (?, ?, ?)',
      [circuitId, title, Number(orderRow?.siguiente || 0)],
    );
    await saveNoteImages(connection, circuitId, result.insertId, files);
    await connection.commit();

    const [[row]] = await pool.query('SELECT * FROM circuitos WHERE id = ?', [circuitId]);
    const [decorated] = await attachCircuitNotes([row]);
    res.status(201).json({ data: decorated, message: 'Nota de pista agregada' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

const updateNote = async (req, res, next) => {
  const connection = await pool.getConnection();
  const files = Array.isArray(req.files) ? req.files : [];
  let previousImages = [];
  let transactionStarted = false;
  let committed = false;
  try {
    await ensureCircuitNotesSchema();
    const circuitId = Number(req.params.id);
    const noteId = Number(req.params.noteId);
    const title = String(req.body.titulo || '').trim().toLocaleUpperCase('es-AR').slice(0, 180);
    if (!Number.isInteger(circuitId) || circuitId < 1 || !Number.isInteger(noteId) || noteId < 1) {
      await Promise.all(files.map(file => deleteNoteFile(toPublicImagePath(file, 'notas'))));
      return res.status(400).json({ error: 'Nota de pista inválida' });
    }
    if (!title) {
      await Promise.all(files.map(file => deleteNoteFile(toPublicImagePath(file, 'notas'))));
      return res.status(400).json({ error: 'Ingresá un título para la nota de pista' });
    }

    const [[note]] = await connection.query(
      'SELECT id FROM circuito_notas WHERE id = ? AND idcircuito = ?',
      [noteId, circuitId],
    );
    if (!note) {
      await Promise.all(files.map(file => deleteNoteFile(toPublicImagePath(file, 'notas'))));
      return res.status(404).json({ error: 'Nota de pista no encontrada' });
    }

    await connection.beginTransaction();
    transactionStarted = true;
    await connection.query('UPDATE circuito_notas SET titulo = ? WHERE id = ? AND idcircuito = ?', [title, noteId, circuitId]);
    if (files.length) {
      [previousImages] = await connection.query(
        'SELECT imagen FROM circuito_notas_imagenes WHERE idnota = ? AND idcircuito = ?',
        [noteId, circuitId],
      );
      await connection.query('DELETE FROM circuito_notas_imagenes WHERE idnota = ? AND idcircuito = ?', [noteId, circuitId]);
      await saveNoteImages(connection, circuitId, noteId, files);
    }
    await connection.commit();
    committed = true;
    if (files.length) await Promise.all(previousImages.map(image => deleteNoteFile(image.imagen)));

    const [[row]] = await pool.query('SELECT * FROM circuitos WHERE id = ?', [circuitId]);
    const [decorated] = await attachCircuitNotes([row]);
    res.json({ data: decorated, message: files.length ? 'Nota e imágenes actualizadas' : 'Título de la nota actualizado' });
  } catch (error) {
    if (transactionStarted && !committed) await connection.rollback();
    if (!committed) await Promise.all(files.map(file => deleteNoteFile(toPublicImagePath(file, 'notas'))));
    next(error);
  } finally {
    connection.release();
  }
};

const reorderNotes = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await ensureCircuitNotesSchema();
    const circuitId = Number(req.params.id);
    const noteIds = [...new Set((Array.isArray(req.body.noteIds) ? req.body.noteIds : []).map(Number))];
    if (!Number.isInteger(circuitId) || circuitId < 1 || noteIds.some(id => !Number.isInteger(id) || id < 1)) {
      return res.status(400).json({ error: 'Orden de notas inválido' });
    }
    const [currentNotes] = await connection.query(
      'SELECT id FROM circuito_notas WHERE idcircuito = ? ORDER BY orden ASC, id ASC',
      [circuitId],
    );
    const currentIds = currentNotes.map(note => Number(note.id));
    if (currentIds.length !== noteIds.length || currentIds.some(id => !noteIds.includes(id))) {
      return res.status(400).json({ error: 'El orden debe incluir todas las notas del circuito' });
    }
    await connection.beginTransaction();
    for (let index = 0; index < noteIds.length; index += 1) {
      await connection.query(
        'UPDATE circuito_notas SET orden = ? WHERE id = ? AND idcircuito = ?',
        [index, noteIds[index], circuitId],
      );
    }
    await connection.commit();
    const [[row]] = await pool.query('SELECT * FROM circuitos WHERE id = ?', [circuitId]);
    const [decorated] = await attachCircuitNotes([row]);
    res.json({ data: decorated, message: 'Orden de las notas actualizado' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

const reuseNotes = async (req, res, next) => {
  const connection = await pool.getConnection();
  const copiedPaths = [];
  let transactionStarted = false;
  let committed = false;
  try {
    await ensureCircuitNotesSchema();
    const circuitId = Number(req.params.id);
    const noteIds = [...new Set((Array.isArray(req.body.noteIds) ? req.body.noteIds : []).map(Number))];
    if (!Number.isInteger(circuitId) || circuitId < 1 || !noteIds.length || noteIds.some(id => !Number.isInteger(id) || id < 1)) {
      return res.status(400).json({ error: 'Seleccioná al menos una nota válida' });
    }
    const [[destinationCircuit]] = await connection.query('SELECT id, nombre FROM circuitos WHERE id = ?', [circuitId]);
    if (!destinationCircuit) return res.status(404).json({ error: 'Circuito no encontrado' });
    const [sourceNotes] = await connection.query(
      `SELECT n.id, n.titulo, n.idcircuito
       FROM circuito_notas n
       INNER JOIN circuitos c ON c.id = n.idcircuito
       WHERE n.id IN (?) AND n.idcircuito <> ? AND LOWER(TRIM(c.nombre)) = LOWER(TRIM(?))`,
      [noteIds, circuitId, destinationCircuit.nombre],
    );
    if (sourceNotes.length !== noteIds.length) {
      return res.status(400).json({ error: 'Solo podés reutilizar notas de otras variantes del mismo circuito' });
    }
    const [sourceImages] = await connection.query(
      'SELECT idnota, imagen, orden FROM circuito_notas_imagenes WHERE idnota IN (?) ORDER BY orden ASC, id ASC',
      [noteIds],
    );
    const imagesByNote = sourceImages.reduce((map, image) => {
      const key = String(image.idnota);
      if (!map[key]) map[key] = [];
      map[key].push(image);
      return map;
    }, {});
    const noteById = new Map(sourceNotes.map(note => [Number(note.id), note]));
    const orderedSources = noteIds.map(id => noteById.get(id));

    await connection.beginTransaction();
    transactionStarted = true;
    const [[orderRow]] = await connection.query(
      'SELECT COALESCE(MAX(orden), -1) + 1 AS siguiente FROM circuito_notas WHERE idcircuito = ?',
      [circuitId],
    );
    let noteOrder = Number(orderRow?.siguiente || 0);
    for (const sourceNote of orderedSources) {
      const [noteResult] = await connection.query(
        'INSERT INTO circuito_notas (idcircuito, titulo, orden) VALUES (?, ?, ?)',
        [circuitId, sourceNote.titulo, noteOrder],
      );
      const images = imagesByNote[String(sourceNote.id)] || [];
      for (let imageOrder = 0; imageOrder < images.length; imageOrder += 1) {
        const copiedPath = await cloneNoteImage(images[imageOrder].imagen);
        copiedPaths.push(copiedPath);
        await connection.query(
          'INSERT INTO circuito_notas_imagenes (idcircuito, idnota, imagen, orden) VALUES (?, ?, ?, ?)',
          [circuitId, noteResult.insertId, copiedPath, imageOrder],
        );
      }
      noteOrder += 1;
    }
    await connection.commit();
    committed = true;
    const [[row]] = await pool.query('SELECT * FROM circuitos WHERE id = ?', [circuitId]);
    const [decorated] = await attachCircuitNotes([row]);
    res.status(201).json({ data: decorated, message: `${noteIds.length} nota${noteIds.length === 1 ? '' : 's'} reutilizada${noteIds.length === 1 ? '' : 's'}` });
  } catch (error) {
    if (transactionStarted && !committed) await connection.rollback();
    if (!committed) await Promise.all(copiedPaths.map(deleteNoteFile));
    next(error);
  } finally {
    connection.release();
  }
};

const removeNote = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await ensureCircuitNotesSchema();
    await connection.beginTransaction();
    const [images] = await connection.query(
      'SELECT imagen FROM circuito_notas_imagenes WHERE idcircuito = ? AND idnota = ?',
      [req.params.id, req.params.noteId],
    );
    const [result] = await connection.query(
      'DELETE FROM circuito_notas WHERE id = ? AND idcircuito = ?',
      [req.params.noteId, req.params.id],
    );
    if (!result.affectedRows) {
      await connection.rollback();
      return res.status(404).json({ error: 'Nota de pista no encontrada' });
    }
    await connection.query('DELETE FROM circuito_notas_imagenes WHERE idnota = ?', [req.params.noteId]);
    await connection.commit();
    await Promise.all(images.map(image => deleteNoteFile(image.imagen)));
    res.json({ message: 'Nota de pista eliminada' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

const removeNoteImage = async (req, res, next) => {
  try {
    await ensureCircuitNotesSchema();
    const [[image]] = await pool.query(
      'SELECT id, imagen FROM circuito_notas_imagenes WHERE id = ? AND idcircuito = ? AND idnota = ?',
      [req.params.imageId, req.params.id, req.params.noteId],
    );
    if (!image) return res.status(404).json({ error: 'Imagen de notas no encontrada' });
    await pool.query('DELETE FROM circuito_notas_imagenes WHERE id = ?', [image.id]);
    await deleteNoteFile(image.imagen);
    res.json({ message: 'Imagen eliminada' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAll, getById, create, update, remove, createNote, updateNote, reorderNotes, reuseNotes, removeNote, removeNoteImage, ensureCircuitNotesSchema, attachCircuitNotes };
