require('dotenv').config();

const pool = require('../src/config/db');

const migrate = async () => {
  const [columns] = await pool.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'inscripciones_config'
       AND COLUMN_NAME = 'banner'
     LIMIT 1`
  );

  if (columns.length) {
    await pool.query('ALTER TABLE inscripciones_config DROP COLUMN banner');
    console.log('Columna banner eliminada.');
  }
  console.log('Migración completada.');
};

migrate()
  .catch(error => {
    console.error(`No se pudo migrar: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
