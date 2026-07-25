require('dotenv').config();
const pool = require('../src/config/db');

const countryCase = field => `CASE LOWER(TRIM(${field}))
  WHEN 'argentina' THEN 'ar'
  WHEN 'brasil' THEN 'br'
  WHEN 'brazil' THEN 'br'
  WHEN 'chile' THEN 'cl'
  WHEN 'uruguay' THEN 'uy'
  WHEN 'paraguay' THEN 'py'
  WHEN 'ecuador' THEN 'ec'
  WHEN 'venezuela' THEN 've'
  WHEN 'colombia' THEN 'co'
  ELSE LOWER(TRIM(${field}))
END`;

const knownCountries = "'argentina','brasil','brazil','chile','uruguay','paraguay','ecuador','venezuela','colombia'";

const migrate = async () => {
  try {
    const [[drivers], [circuits]] = await Promise.all([
      pool.query(`UPDATE pilotos SET nacionalidad = ${countryCase('nacionalidad')} WHERE LOWER(TRIM(nacionalidad)) IN (${knownCountries})`),
      pool.query(`UPDATE circuitos SET pais = ${countryCase('pais')} WHERE LOWER(TRIM(pais)) IN (${knownCountries})`),
    ]);

    console.log(`Pilotos migrados: ${drivers.affectedRows}`);
    console.log(`Circuitos migrados: ${circuits.affectedRows}`);
  } finally {
    await pool.end();
  }
};

migrate().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
