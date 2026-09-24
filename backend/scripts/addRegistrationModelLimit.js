require('dotenv').config({ quiet: true });
const pool = require('../src/config/db');

const run = async () => {
  const [columns] = await pool.query(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'inscripciones_config'
       AND COLUMN_NAME = 'limite_por_modelo'`,
  );

  if (!columns.length) {
    await pool.query(
      `ALTER TABLE inscripciones_config
       ADD COLUMN limite_por_modelo SMALLINT UNSIGNED NULL AFTER limite_inscriptos`,
    );
    await pool.query(
      `UPDATE inscripciones_config
       SET limite_por_modelo = GREATEST(
         1,
         CEIL(limite_inscriptos / GREATEST(1, JSON_LENGTH(autos_habilitados)))
       )
       WHERE limite_por_modelo IS NULL`,
    );
    await pool.query(
      `ALTER TABLE inscripciones_config
       MODIFY COLUMN limite_por_modelo SMALLINT UNSIGNED NOT NULL DEFAULT 10`,
    );
    console.log('Columna limite_por_modelo creada y configuraciones existentes migradas.');
  } else {
    console.log('La columna limite_por_modelo ya existe.');
  }
};

run()
  .then(() => pool.end())
  .catch(async error => {
    console.error(error);
    await pool.end();
    process.exit(1);
  });
