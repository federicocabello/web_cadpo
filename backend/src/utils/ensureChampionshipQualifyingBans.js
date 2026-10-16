const pool = require('../config/db');

let schemaPromise;

const ensureChampionshipQualifyingBans = () => {
  if (!schemaPromise) {
    schemaPromise = pool.query(`CREATE TABLE IF NOT EXISTS campeonato_sanciones_clasificacion (
      idcampeonato INT NOT NULL,
      idpiloto INT NOT NULL,
      tandas_pendientes SMALLINT UNSIGNED NOT NULL DEFAULT 1,
      creado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actualizado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (idcampeonato, idpiloto),
      KEY idx_sanciones_clasificacion_piloto (idpiloto)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`).catch(error => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
};

module.exports = ensureChampionshipQualifyingBans;
