const pool = require('../config/db');

let schemaPromise;

const ensureChampionshipWarnings = () => {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS campeonato_apercibimientos (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          idcampeonato INT NOT NULL,
          cantidad SMALLINT UNSIGNED NOT NULL,
          sancion VARCHAR(500) NOT NULL,
          PRIMARY KEY (id),
          UNIQUE KEY uq_campeonato_apercibimiento (idcampeonato, cantidad),
          KEY idx_campeonato_apercibimientos (idcampeonato)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS campeonato_apercibimientos_cumplimientos (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          idcampeonato INT NOT NULL,
          idpiloto INT NOT NULL,
          cantidad SMALLINT UNSIGNED NOT NULL,
          cumplida TINYINT(1) NOT NULL DEFAULT 0,
          actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_apercibimiento_cumplimiento (idcampeonato, idpiloto, cantidad),
          KEY idx_apercibimiento_pendiente (idcampeonato, cumplida)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    })().catch(error => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
};

module.exports = ensureChampionshipWarnings;
