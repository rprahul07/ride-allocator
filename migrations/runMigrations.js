const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

const runMigrations = async () => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Read and execute initial schema
    const schemaSQL = fs.readFileSync(
      path.join(__dirname, '001_initial_schema.sql'),
      'utf8'
    );
    await client.query(schemaSQL);
    console.log('✓ Initial schema created');
    
    // Read and execute seed data
    const seedSQL = fs.readFileSync(
      path.join(__dirname, '002_seed_data.sql'),
      'utf8'
    );
    await client.query(seedSQL);
    console.log('✓ Seed data inserted');
    
    // Read and execute remove Firebase migration
    const removeFirebaseSQL = fs.readFileSync(
      path.join(__dirname, '004_remove_firebase.sql'),
      'utf8'
    );
    await client.query(removeFirebaseSQL);
    console.log('✓ Firebase columns removed');
    
    // Set default admin password
    const adminResult = await client.query('SELECT id FROM admin WHERE username = $1', ['admin']);
    if (adminResult.rows.length > 0) {
      const adminId = adminResult.rows[0].id;
      const defaultPassword = 'Admin@123';
      const passwordHash = await bcrypt.hash(defaultPassword, 12);
      
      await client.query(
        'INSERT INTO admin_credentials (admin_id, password_hash) VALUES ($1, $2) ON CONFLICT (admin_id) DO UPDATE SET password_hash = $2',
        [adminId, passwordHash]
      );
      console.log('✓ Default admin password set (Admin@123)');
    }
    
    await client.query('COMMIT');
    console.log('\n✅ All migrations completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

runMigrations()
  .then(() => {
    console.log('Database setup complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Database setup failed:', error);
    process.exit(1);
  });
