const pool = require('../config/db');

const columns = {
  pole_sprint: 'TINYINT(1) NOT NULL DEFAULT 0',
  ganador_sprint: 'TINYINT(1) NOT NULL DEFAULT 0',
  pole_final: 'TINYINT(1) NOT NULL DEFAULT 0',
  ganador_final: 'TINYINT(1) NOT NULL DEFAULT 0',
  campeon: 'TINYINT(1) NOT NULL DEFAULT 0',
  desc_sancion_qualy_sprint: "VARCHAR(500) NOT NULL DEFAULT ''",
  desc_sancion_sprint: "VARCHAR(500) NOT NULL DEFAULT ''",
  desc_sancion_qualy_final: "VARCHAR(500) NOT NULL DEFAULT ''",
  desc_sancion_final: "VARCHAR(500) NOT NULL DEFAULT ''",
};

let schemaPromise;

const ensureResultAchievements = () => {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const [existingColumns] = await pool.query(
        `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'resultados'`
      );
      const existing = new Set(existingColumns.map(column => column.COLUMN_NAME));
      for (const [column, definition] of Object.entries(columns)) {
        if (!existing.has(column)) await pool.query(`ALTER TABLE resultados ADD COLUMN ${column} ${definition}`);
      }
    })().catch(error => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
};

module.exports = ensureResultAchievements;
