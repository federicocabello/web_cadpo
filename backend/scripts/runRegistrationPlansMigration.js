const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const pool = require('../src/config/db');

const hasColumn = async (table, column) => {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [table, column],
  );
  return rows.length > 0;
};

const addColumn = async (table, column, definition) => {
  if (await hasColumn(table, column)) return;
  await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  console.log(`Agregada: ${table}.${column}`);
};

const run = async () => {
  await addColumn('inscripciones_config', 'planes', 'JSON NULL AFTER autos_habilitados');
  await addColumn('inscripciones_detalle', 'plan_id', 'VARCHAR(64) NULL AFTER modalidad_diseno');
  await addColumn('inscripciones_detalle', 'plan_titulo', 'VARCHAR(120) NULL AFTER plan_id');
  await addColumn('inscripciones_detalle', 'precio_total', 'DECIMAL(10,2) NULL AFTER plan_titulo');
  console.log('Migración de planes de inscripción verificada correctamente.');
};

run()
  .catch(error => {
    console.error(`No se pudo aplicar la migración: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
