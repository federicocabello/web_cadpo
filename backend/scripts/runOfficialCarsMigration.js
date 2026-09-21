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
  await pool.query(
    `CREATE TABLE IF NOT EXISTS inscripciones_autos_oficiales (
       id INT UNSIGNED NOT NULL AUTO_INCREMENT,
       idcampeonato SMALLINT NOT NULL,
       idauto SMALLINT NOT NULL,
       numero SMALLINT UNSIGNED NOT NULL,
       descripcion VARCHAR(500) NOT NULL,
       foto VARCHAR(500) NOT NULL,
       creado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (id),
       UNIQUE KEY uq_auto_oficial_numero (idcampeonato, numero),
       KEY idx_auto_oficial_campeonato_modelo (idcampeonato, idauto)
     )`,
  );
  if (!await hasColumn('idauto_oficial')) {
    await pool.query('ALTER TABLE inscriptos ADD COLUMN idauto_oficial INT UNSIGNED NULL AFTER tipo_inscripcion');
    console.log('Agregada: inscriptos.idauto_oficial');
  }
  console.log('Migración de autos oficiales verificada correctamente.');
};

run()
  .catch(error => {
    console.error(`No se pudo aplicar la migración: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
