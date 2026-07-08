const mysql2 = require('mysql2/promise');

const pool = mysql2.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'web_cadpo',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

pool.getConnection()
  .then(conn => {
    console.log('Conectado a MySQL');
    conn.release();
  })
  .catch(err => {
    console.error('Error de conexion a MySQL:', err.message);
    console.warn('El servidor continua sin base de datos. Configura el .env con tus credenciales.');
  });

module.exports = pool;
