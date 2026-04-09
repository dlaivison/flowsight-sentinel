const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'flowsight',
  user:     process.env.DB_USER     || 'flowsight',
  password: process.env.DB_PASSWORD || 'flowsight_secure_2026',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Erro no pool PostgreSQL:', err);
});

async function query(text, params) {
  const res = await pool.query(text, params);
  return res;
}

async function getClient() {
  return pool.connect();
}

module.exports = { query, getClient, pool };
