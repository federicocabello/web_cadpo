const pool = require('../config/db');

let ensurePromise = null;

const ensureEventMultipliers = async () => {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const [columns] = await pool.query('SHOW COLUMNS FROM calendario');
      const existing = new Set(columns.map(column => column.Field));
      const changes = [];
      let visibilityColumnAdded = false;
      if (!existing.has('multiplicador_sprint')) {
        changes.push('ADD COLUMN multiplicador_sprint DECIMAL(6,3) UNSIGNED NOT NULL DEFAULT 1 AFTER transmision');
      }
      if (!existing.has('multiplicador_final')) {
        changes.push('ADD COLUMN multiplicador_final DECIMAL(6,3) UNSIGNED NOT NULL DEFAULT 1 AFTER multiplicador_sprint');
      }
      if (!existing.has('resultados_visibles')) {
        // Existing dates stay published. New dates start hidden until the
        // stewards finish and an administrator explicitly publishes them.
        changes.push('ADD COLUMN resultados_visibles TINYINT(1) NOT NULL DEFAULT 1');
        visibilityColumnAdded = true;
      }
      if (!existing.has('limite_apelaciones')) {
        changes.push('ADD COLUMN limite_apelaciones DATETIME NULL');
      }
      if (!existing.has('resultados_confirmados')) {
        changes.push('ADD COLUMN resultados_confirmados TINYINT(1) NOT NULL DEFAULT 0');
      }
      if (changes.length) await pool.query(`ALTER TABLE calendario ${changes.join(', ')}`);
      if (visibilityColumnAdded) {
        await pool.query('ALTER TABLE calendario MODIFY COLUMN resultados_visibles TINYINT(1) NOT NULL DEFAULT 0');
      }
    })().catch(error => {
      ensurePromise = null;
      throw error;
    });
  }
  return ensurePromise;
};

module.exports = ensureEventMultipliers;
