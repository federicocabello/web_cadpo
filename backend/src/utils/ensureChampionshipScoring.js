const pool = require('../config/db');

let schemaPromise;

const ensureChampionshipScoring = () => {
  if (!schemaPromise) {
    schemaPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS campeonato_puntajes (
        idcampeonato INT NOT NULL,
        posicion SMALLINT UNSIGNED NOT NULL,
        pts_qualy_sprint DECIMAL(8,2) NOT NULL DEFAULT 0,
        pts_sprint DECIMAL(8,2) NOT NULL DEFAULT 0,
        pts_qualy_final DECIMAL(8,2) NOT NULL DEFAULT 0,
        pts_final DECIMAL(8,2) NOT NULL DEFAULT 0,
        PRIMARY KEY (idcampeonato, posicion),
        KEY idx_campeonato_puntajes (idcampeonato)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(error => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
};

module.exports = ensureChampionshipScoring;
