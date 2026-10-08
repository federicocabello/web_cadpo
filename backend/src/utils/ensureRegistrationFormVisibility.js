const pool = require('../config/db');

let schemaPromise = null;

const ensureRegistrationFormVisibility = () => {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const [columns] = await pool.query("SHOW COLUMNS FROM inscripciones_config LIKE 'visible'");
      if (!columns.length) {
        await pool.query('ALTER TABLE inscripciones_config ADD COLUMN visible TINYINT(1) NOT NULL DEFAULT 1');
      }
    })().catch(error => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
};

module.exports = ensureRegistrationFormVisibility;
