const pool = require('../config/db');

let schemaPromise;

const ensureChampionshipScoring = () => {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS campeonato_puntajes (
          idcampeonato INT NOT NULL,
          posicion SMALLINT UNSIGNED NOT NULL,
          pts_qualy_sprint DECIMAL(8,2) NOT NULL DEFAULT 0,
          pts_sprint DECIMAL(8,2) NOT NULL DEFAULT 0,
          kg_sprint SMALLINT NOT NULL DEFAULT 0,
          pts_qualy_final DECIMAL(8,2) NOT NULL DEFAULT 0,
          pts_final DECIMAL(8,2) NOT NULL DEFAULT 0,
          kg_final SMALLINT NOT NULL DEFAULT 0,
          PRIMARY KEY (idcampeonato, posicion),
          KEY idx_campeonato_puntajes (idcampeonato)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      const [columns] = await pool.query('SHOW COLUMNS FROM campeonato_puntajes');
      const existing = new Set(columns.map(column => column.Field));
      if (!existing.has('kg_sprint')) {
        try {
          await pool.query('ALTER TABLE campeonato_puntajes ADD COLUMN kg_sprint SMALLINT NOT NULL DEFAULT 0 AFTER pts_sprint');
        } catch (error) {
          if (error.errno !== 1060) throw error;
        }
      }
      if (!existing.has('kg_final')) {
        try {
          await pool.query('ALTER TABLE campeonato_puntajes ADD COLUMN kg_final SMALLINT NOT NULL DEFAULT 0 AFTER pts_final');
        } catch (error) {
          if (error.errno !== 1060) throw error;
        }
      }
    })().catch(error => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
};

module.exports = ensureChampionshipScoring;
