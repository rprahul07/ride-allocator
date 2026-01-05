/**
 * Script to create a new driver account
 * Usage: node scripts/createDriver.js <phone_number> <name> <password> [license_number] [vehicle_number]
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

const createDriver = async () => {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.error('Usage: node scripts/createDriver.js <phone_number> <name> <password> [license_number] [vehicle_number]');
    process.exit(1);
  }

  const [phoneNumber, name, password, licenseNumber, vehicleNumber] = args;

  try {
    // Check if driver already exists
    const existing = await query(
      'SELECT id FROM drivers WHERE phone_number = $1',
      [phoneNumber]
    );

    if (existing.rows.length > 0) {
      console.error('Driver with this phone number already exists');
      process.exit(1);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create driver
    const driverResult = await query(
      `INSERT INTO drivers (phone_number, name, license_number, vehicle_number, is_available)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, phone_number, name`,
      [phoneNumber, name, licenseNumber || null, vehicleNumber || null]
    );

    const driver = driverResult.rows[0];

    // Create credentials
    await query(
      'INSERT INTO driver_credentials (driver_id, password_hash) VALUES ($1, $2)',
      [driver.id, passwordHash]
    );

    console.log('✅ Driver created successfully!');
    console.log('Driver ID:', driver.id);
    console.log('Phone:', driver.phone_number);
    console.log('Name:', driver.name);
    console.log('\nDriver can now login with:');
    console.log('Phone:', phoneNumber);
    console.log('Password:', password);
  } catch (error) {
    console.error('❌ Error creating driver:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
};

createDriver();
