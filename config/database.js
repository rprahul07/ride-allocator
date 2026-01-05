const { Pool } = require('pg');
require('dotenv').config();



const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // transaction pooler URL

  max: 10,                  // DO NOT increase beyond 10
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,

  ssl: { rejectUnauthorized: false },

  keepAlive: true,
});


// Test connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Helper function to execute queries with error handling
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

// Helper function to get a client for transactions with retry logic
const getClient = async (retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      const query = client.query.bind(client);
      const release = client.release.bind(client);
      
      // Set a timeout of 30 seconds for long transactions
      const timeout = setTimeout(() => {
        console.warn('A client has been checked out for more than 30 seconds!');
      }, 30000);
      
      client.release = () => {
        clearTimeout(timeout);
        return release();
      };
      
      return client;
    } catch (error) {
      if (i === retries - 1) throw error;
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 100));
    }
  }
};

// Helper function to execute transaction with retry logic for deadlocks
const executeTransaction = async (callback, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      // Set isolation level to prevent dirty reads and lost updates
      await client.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
      
      const result = await callback(client);
      
      await client.query('COMMIT');
      client.release();
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {}); // Ignore rollback errors
      client.release();
      
      // Retry on deadlock or serialization failure
      if (
        (error.code === '40001' || error.code === '40P01') && 
        i < retries - 1
      ) {
        const delay = Math.pow(2, i) * 100 + Math.random() * 100;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
};

// Monitor pool statistics
setInterval(() => {
  const stats = {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
  if (stats.waitingCount > 0 || stats.totalCount > 80) {
    console.warn('Database pool statistics:', stats);
  }
}, 60000); // Log every minute

module.exports = {
  pool,
  query,
  getClient,
  executeTransaction,
};
