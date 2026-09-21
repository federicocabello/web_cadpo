const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
  quiet: true,
});

const pool = require('../src/config/db');

const hasColumn = async (table, column) => {
  const [rows] = await pool.query(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [table, column],
  );
  return rows.length > 0;
};

const run = async () => {
  if (!await hasColumn('inscripciones_config', 'precio_pintura_oficial')) {
    await pool.query(
      'ALTER TABLE inscripciones_config ADD COLUMN precio_pintura_oficial DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER precio_diseno',
    );
    console.log('Agregada: inscripciones_config.precio_pintura_oficial');
  }

  if (!await hasColumn('inscripciones_config', 'permite_pintura_oficial')) {
    await pool.query(
      'ALTER TABLE inscripciones_config ADD COLUMN permite_pintura_oficial TINYINT(1) NOT NULL DEFAULT 0 AFTER permite_diseno_liga',
    );
    console.log('Agregada: inscripciones_config.permite_pintura_oficial');
  }

  const [columns] = await pool.query("SHOW COLUMNS FROM inscripciones_detalle LIKE 'modalidad_diseno'");
  if (!columns.length) throw new Error('No existe inscripciones_detalle.modalidad_diseno');
  if (!String(columns[0].Type).includes("'pintura_oficial'")) {
    await pool.query(
      "ALTER TABLE inscripciones_detalle MODIFY COLUMN modalidad_diseno ENUM('personalizado', 'personalizado_liga', 'pintura_oficial', 'extra') NOT NULL",
    );
    console.log('Actualizada: inscripciones_detalle.modalidad_diseno');
  }

  console.log('Migración de pintura oficial verificada correctamente.');
};

run()
  .catch(error => {
    console.error(`No se pudo aplicar la migración: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
