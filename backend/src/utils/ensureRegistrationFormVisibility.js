const pool = require('../config/db');

let schemaPromise = null;

const ensureRegistrationFormVisibility = () => {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const [columns] = await pool.query("SHOW COLUMNS FROM inscripciones_config LIKE 'visible'");
      if (!columns.length) {
        await pool.query('ALTER TABLE inscripciones_config ADD COLUMN visible TINYINT(1) NOT NULL DEFAULT 1');
      }
      const [liveBroadcastColumns] = await pool.query("SHOW COLUMNS FROM inscripciones_config LIKE 'transmision_en_vivo'");
      if (!liveBroadcastColumns.length) {
        await pool.query('ALTER TABLE inscripciones_config ADD COLUMN transmision_en_vivo TINYINT(1) NOT NULL DEFAULT 0 AFTER visible');
        await pool.query('UPDATE inscripciones_config SET transmision_en_vivo = CASE WHEN precio > 10000 THEN 1 ELSE 0 END');
      }
    })().catch(error => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
};

module.exports = ensureRegistrationFormVisibility;
