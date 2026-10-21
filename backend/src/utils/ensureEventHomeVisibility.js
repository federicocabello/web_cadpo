const pool = require('../config/db');

let schemaPromise = null;

const ensureEventHomeVisibility = () => {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const [visibleColumns] = await pool.query("SHOW COLUMNS FROM calendario LIKE 'mostrar_inicio'");
      if (!visibleColumns.length) {
        await pool.query('ALTER TABLE calendario ADD COLUMN mostrar_inicio TINYINT(1) NOT NULL DEFAULT 0 AFTER transmision');
      }

      const [startColumns] = await pool.query("SHOW COLUMNS FROM calendario LIKE 'mostrar_desde'");
      if (!startColumns.length) {
        await pool.query('ALTER TABLE calendario ADD COLUMN mostrar_desde DATETIME NULL AFTER mostrar_inicio');
      }
    })().catch(error => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
};

module.exports = ensureEventHomeVisibility;
