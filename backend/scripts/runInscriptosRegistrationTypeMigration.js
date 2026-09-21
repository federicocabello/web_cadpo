const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const pool = require('../src/config/db');

const hasColumn = async column => {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inscriptos' AND COLUMN_NAME = ? LIMIT 1`,
    [column],
  );
  return rows.length > 0;
};

const run = async () => {
  if (!await hasColumn('tipo_inscripcion')) {
    await pool.query(
      "ALTER TABLE inscriptos ADD COLUMN tipo_inscripcion ENUM('extra', 'personalizado', 'diseno_liga', 'diseno_oficial') NULL AFTER numero",
    );
    console.log('Agregada: inscriptos.tipo_inscripcion');
  }
  if (!await hasColumn('precio_inscripcion')) {
    await pool.query(
      'ALTER TABLE inscriptos ADD COLUMN precio_inscripcion DECIMAL(10,2) NULL AFTER tipo_inscripcion',
    );
    console.log('Agregada: inscriptos.precio_inscripcion');
  }
  console.log('Migración de inscriptos verificada correctamente.');
};

run()
  .catch(error => {
    console.error(`No se pudo aplicar la migración: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
