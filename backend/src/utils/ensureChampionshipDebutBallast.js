const pool = require('../config/db');

let schemaPromise;

const ensureChampionshipDebutBallast = () => {
  if (!schemaPromise) {
    schemaPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS campeonato_lastres_debut (
        idcampeonato INT NOT NULL,
        idpiloto INT NOT NULL,
        kilos DECIMAL(8,2) NOT NULL DEFAULT 0,
        actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (idcampeonato, idpiloto),
        KEY idx_lastres_debut_campeonato (idcampeonato)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(error => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
};

module.exports = ensureChampionshipDebutBallast;
