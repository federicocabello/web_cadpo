const pool = require('../config/db');

let ensurePromise = null;

const ensureEventMultipliers = async () => {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const [columns] = await pool.query('SHOW COLUMNS FROM calendario');
      const existing = new Set(columns.map(column => column.Field));
      const changes = [];
      if (!existing.has('multiplicador_sprint')) {
        changes.push('ADD COLUMN multiplicador_sprint DECIMAL(6,3) UNSIGNED NOT NULL DEFAULT 1 AFTER transmision');
      }
      if (!existing.has('multiplicador_final')) {
        changes.push('ADD COLUMN multiplicador_final DECIMAL(6,3) UNSIGNED NOT NULL DEFAULT 1 AFTER multiplicador_sprint');
      }
      if (changes.length) await pool.query(`ALTER TABLE calendario ${changes.join(', ')}`);
    })().catch(error => {
      ensurePromise = null;
      throw error;
    });
  }
  return ensurePromise;
};

module.exports = ensureEventMultipliers;
