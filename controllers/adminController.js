const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { generateToken } = require('../utils/jwt');
const notificationService = require('../services/notificationService');
const logger = require('../config/logger');

// Admin login
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Get admin
    const adminResult = await query(
      'SELECT id, username, email, phone_number FROM admin WHERE username = $1',
      [username]
    );

    if (adminResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const admin = adminResult.rows[0];

    // Verify password
    const credResult = await query(
      'SELECT password_hash FROM admin_credentials WHERE admin_id = $1',
      [admin.id]
    );

    if (credResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const isValid = await bcrypt.compare(password, credResult.rows[0].password_hash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Update last login
    await query(
      'UPDATE admin SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [admin.id]
    );

    // Generate JWT token
    const token = generateToken({
      id: admin.id,
      role: 'admin',
      username: admin.username,
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        admin: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
        },
      },
    });
  } catch (error) {
    logger.error('Error in admin login:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
    });
  }
};

// Get all pending ride requests
const getPendingRides = async (req, res) => {
  try {
    const result = await query(
      `SELECT r.id, r.pickup_address, r.drop_address, r.status,
              r.requested_at, u.phone_number as user_phone
       FROM rides r
       JOIN users u ON r.user_id = u.id
       WHERE r.status = 'pending'
       ORDER BY r.requested_at ASC`
    );

    res.status(200).json({
      success: true,
      data: {
        rides: result.rows || [],
      },
    });
  } catch (error) {
    logger.error('Error getting pending rides:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get pending rides',
    });
  }
};

// Get all available drivers
const getAvailableDrivers = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, phone_number, license_number, vehicle_number
       FROM drivers
       WHERE is_active = true AND is_available = true
       ORDER BY name`
    );

    res.status(200).json({
      success: true,
      data: {
        drivers: result.rows || [],
      },
    });
  } catch (error) {
    logger.error('Error getting available drivers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get available drivers',
    });
  }
};

// Assign driver to ride (with row-level locking to prevent race conditions)
const assignDriver = async (req, res) => {
  const { executeTransaction } = require('../config/database');
  
  try {
    const adminId = req.user.id;
    const { ride_id, driver_id } = req.body;

    const result = await executeTransaction(async (client) => {
      // Lock ride row to prevent concurrent assignments (SELECT FOR UPDATE)
      const rideResult = await client.query(
        'SELECT id, user_id, status FROM rides WHERE id = $1 FOR UPDATE',
        [ride_id]
      );

      if (rideResult.rows.length === 0) {
        throw new Error('RIDE_NOT_FOUND');
      }

      const ride = rideResult.rows[0];

      if (ride.status !== 'pending') {
        throw new Error(`Ride cannot be assigned. Current status: ${ride.status}`);
      }

      // Lock driver row to prevent concurrent assignments (SELECT FOR UPDATE)
      const driverResult = await client.query(
        'SELECT id, name, is_active, is_available FROM drivers WHERE id = $1 FOR UPDATE',
        [driver_id]
      );

      if (driverResult.rows.length === 0) {
        throw new Error('DRIVER_NOT_FOUND');
      }

      const driver = driverResult.rows[0];

      if (!driver.is_active) {
        throw new Error('Driver is inactive');
      }

      if (!driver.is_available) {
        throw new Error('Driver is not available');
      }

      // Assign driver and mark driver as unavailable in single transaction
      await client.query(
        `UPDATE rides
         SET driver_id = $1, admin_id = $2, status = 'assigned', assigned_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND status = 'pending'`,
        [driver_id, adminId, ride_id]
      );

      // Check if update was successful (prevents race condition)
      const updateCheck = await client.query(
        'SELECT status FROM rides WHERE id = $1',
        [ride_id]
      );

      if (updateCheck.rows[0].status !== 'assigned') {
        throw new Error('Ride assignment failed. Another admin may have assigned it.');
      }

      // Mark driver as unavailable
      await client.query(
        'UPDATE drivers SET is_available = false WHERE id = $1',
        [driver_id]
      );

      return { ride, driver };
    });

    // Notifications outside transaction to avoid long-running transactions
    try {
      await notificationService.notifyDriver(
        driver_id,
        ride_id,
        `You have been assigned a new ride. Pickup: ${result.ride.pickup_address}`
      );

      await notificationService.notifyUser(
        result.ride.user_id,
        ride_id,
        'A driver has been assigned to your ride request.'
      );
    } catch (notifError) {
      logger.error('Notification error (non-critical):', notifError);
      // Don't fail the request if notification fails
    }

    // Get updated ride
    const updatedRide = await query(
      `SELECT r.*, d.name as driver_name, d.phone_number as driver_phone
       FROM rides r
       LEFT JOIN drivers d ON r.driver_id = d.id
       WHERE r.id = $1`,
      [ride_id]
    );

    res.status(200).json({
      success: true,
      message: 'Driver assigned successfully',
      data: {
        ride: updatedRide.rows[0],
      },
    });
  } catch (error) {
    logger.error('Error assigning driver:', error);
    
    if (error.message === 'RIDE_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Ride not found',
      });
    }
    
    if (error.message === 'DRIVER_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Driver not found',
      });
    }
    
    if (error.message.includes('cannot be assigned') || error.message.includes('not available')) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to assign driver. Please try again.',
    });
  }
};

// Get all rides (with filters)
const getAllRides = async (req, res) => {
  try {
    const status = req.query.status;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;

    // Whitelist validation for status (security best practice)
    const ALLOWED_STATUSES = ['pending', 'assigned', 'in_progress', 'completed'];
    if (status && !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(', ')}`,
      });
    }

    let queryText = `
      SELECT r.*, u.name as user_name,u.phone_number as user_phone, d.name as driver_name, d.phone_number as driver_phone
      FROM rides r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN drivers d ON r.driver_id = d.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      queryText += ` AND r.status = $${params.length + 1}`;
      params.push(status);
    }

    if (startDate) {
      queryText += ` AND r.requested_at >= $${params.length + 1}`;
      params.push(startDate);
    }

    if (endDate) {
      queryText += ` AND r.requested_at <= $${params.length + 1}`;
      params.push(endDate);
    }

    queryText += ` ORDER BY r.requested_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    // Build count query with same filters
    let countQuery = 'SELECT COUNT(*) FROM rides WHERE 1=1';
    const countParams = [];
    if (status) {
      countQuery += ` AND status = $${countParams.length + 1}`;
      countParams.push(status);
    }
    if (startDate) {
      countQuery += ` AND requested_at >= $${countParams.length + 1}`;
      countParams.push(startDate);
    }
    if (endDate) {
      countQuery += ` AND requested_at <= $${countParams.length + 1}`;
      countParams.push(endDate);
    }
    const countResult = await query(countQuery, countParams);

    res.status(200).json({
      success: true,
      data: {
        rides: result.rows || [],
        total: parseInt(countResult.rows[0]?.count || 0),
        limit,
        offset,
      },
    });
  } catch (error) {
    logger.error('Error getting all rides:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get rides',
    });
  }
};

// Get live ride monitoring
const getLiveRides = async (req, res) => {
  try {
    const result = await query(
      `SELECT r.*, u.phone_number as user_phone, d.name as driver_name, d.phone_number as driver_phone
       FROM rides r
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN drivers d ON r.driver_id = d.id
       WHERE r.status IN ('assigned', 'in_progress')
       ORDER BY r.requested_at DESC`
    );

    res.status(200).json({
      success: true,
      data: {
        rides: result.rows || [],
      },
    });
  } catch (error) {
    logger.error('Error getting live rides:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get live rides',
    });
  }
};

// Get driver performance
const getDriverPerformance = async (req, res) => {
  try {
    const driverId = req.query.driver_id;
    const startDate = req.query.start_date;
    const endDate = req.query.end_date || new Date().toISOString();

    let queryText = `
      SELECT 
        d.id,
        d.name,
        d.phone_number,
        COUNT(r.id) as total_rides,
        SUM(r.total_fare) as total_earnings,
        SUM(r.duration_minutes) as total_minutes,
        AVG(r.total_fare) as avg_fare,
        COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as completed_rides
      FROM drivers d
      LEFT JOIN rides r ON d.id = r.driver_id
      WHERE 1=1
    `;
    const params = [];

    if (driverId) {
      queryText += ` AND d.id = $${params.length + 1}`;
      params.push(driverId);
    }

    if (startDate) {
      queryText += ` AND r.ended_at >= $${params.length + 1}`;
      params.push(startDate);
    }

    if (endDate) {
      queryText += ` AND r.ended_at <= $${params.length + 1}`;
      params.push(endDate);
    }

    queryText += ` GROUP BY d.id, d.name, d.phone_number ORDER BY total_rides DESC`;

    const result = await query(queryText, params);

    res.status(200).json({
      success: true,
      data: {
        drivers: result.rows || [],
      },
    });
  } catch (error) {
    logger.error('Error getting driver performance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get driver performance',
    });
  }
};

// Get ride details
const getRideDetails = async (req, res) => {
  try {
    const { ride_id } = req.params;

    const result = await query(
      `SELECT r.*, u.phone_number as user_phone, d.name as driver_name, d.phone_number as driver_phone
       FROM rides r
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN drivers d ON r.driver_id = d.id
       WHERE r.id = $1`,
      [ride_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        ride: result.rows[0],
      },
    });
  } catch (error) {
    logger.error('Error getting ride details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get ride details',
    });
  }
};

module.exports = {
  login,
  getPendingRides,
  getAvailableDrivers,
  assignDriver,
  getAllRides,
  getLiveRides,
  getDriverPerformance,
  getRideDetails,
};
