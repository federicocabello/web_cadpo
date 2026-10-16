const pool = require('../config/db');

let schemaPromise;

const ensureChampionshipExclusions = () => {
  if (!schemaPromise) {
    schemaPromise = pool.query(`CREATE TABLE IF NOT EXISTS campeonato_pilotos_excluidos (
      idcampeonato INT NOT NULL,
      idpiloto INT NOT NULL,
      creado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actualizado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (idcampeonato, idpiloto),
      KEY idx_campeonato_excluidos_piloto (idpiloto)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`).catch(error => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
};

module.exports = ensureChampionshipExclusions;
