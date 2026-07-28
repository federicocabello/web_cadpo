const mysql2 = require('mysql2/promise');

const pool = mysql2.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'web_cadpo',
  dateStrings: true,
  timezone: '-03:00',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

pool.on('connection', connection => {
  connection.query("SET time_zone = '-03:00'");
});

const checkDatabase = async () => {
  const conn = await pool.getConnection();

  try {
    await conn.query('SELECT 1');
    return {
      connected: true,
      database: process.env.DB_NAME || 'web_cadpo',
    };
  } finally {
    conn.release();
  }
};

pool.getConnection()
  .then(conn => {
    console.log('Conectado a MySQL');
    conn.release();
  })
  .catch(err => {
    console.error('Error de conexion a MySQL:', err.message);
    console.warn('El servidor continua sin base de datos. Configura el .env con tus credenciales.');
  });

pool.checkDatabase = checkDatabase;

module.exports = pool;
