require('dotenv').config();
const pool = require('../src/config/db');

async function migrate() {
  const [columns] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'inscripciones_config'
       AND COLUMN_NAME = 'preinscriptos'`
  );

  if (!columns.length) {
    await pool.query(
      `ALTER TABLE inscripciones_config
       ADD COLUMN preinscriptos SMALLINT UNSIGNED NOT NULL DEFAULT 0
       AFTER limite_inscriptos`
    );
    console.log('Columna preinscriptos agregada.');
  } else {
    console.log('La columna preinscriptos ya existe.');
  }
}

migrate()
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
