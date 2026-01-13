const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { generateToken } = require('../utils/jwt');
const billingService = require('../services/billingService');
const notificationService = require('../services/notificationService');
const logger = require('../config/logger');

// Driver login
const login = async (req, res) => {
  try {
    const { phone_number, password } = req.body;

    // Get driver
    const driverResult = await query(
      'SELECT id, phone_number, name, is_active FROM drivers WHERE phone_number = $1',
      [phone_number]
    );

    if (driverResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const driver = driverResult.rows[0];

    if (!driver.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive',
      });
    }

    // Verify password
    const credResult = await query(
      'SELECT password_hash FROM driver_credentials WHERE driver_id = $1',
      [driver.id]
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
      'UPDATE drivers SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [driver.id]
    );

    // Generate JWT token
    const token = generateToken({
      id: driver.id,
      role: 'driver',
      phone_number: driver.phone_number,
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        driver: {
          id: driver.id,
          phone_number: driver.phone_number,
          name: driver.name,
        },
      },
    });
  } catch (error) {
    logger.error('Error in driver login:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
    });
  }
};

// Get assigned rides
const getAssignedRides = async (req, res) => {
  try {
    const driverId = req.user.id;

    const result = await query(
      `SELECT id, pickup_address, drop_address, status, requested_at, assigned_at
       FROM rides
       WHERE driver_id = $1
         AND status IN ('assigned', 'in_progress')
       ORDER BY assigned_at DESC`,
      [driverId]
    );

    res.status(200).json({
      success: true,
      data: {
        rides: result.rows || [],
      },
    });
  } catch (error) {
    logger.error('Error getting assigned rides:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get assigned rides',
    });
  }
};

// Start ride (with row-level locking to prevent race conditions)
const startRide = async (req, res) => {
  const { executeTransaction } = require('../config/database');
  
  try {
    const driverId = req.user.id;
    const { ride_id } = req.body;

    const result = await executeTransaction(async (client) => {
      // Lock ride row to prevent concurrent start operations (SELECT FOR UPDATE)
      const rideResult = await client.query(
        'SELECT id, user_id, status FROM rides WHERE id = $1 AND driver_id = $2 FOR UPDATE',
        [ride_id, driverId]
      );

      if (rideResult.rows.length === 0) {
        throw new Error('RIDE_NOT_FOUND');
      }

      const ride = rideResult.rows[0];

      if (ride.status !== 'assigned') {
        throw new Error(`Ride cannot be started. Current status: ${ride.status}`);
      }

      // Update ride status and start time atomically
      const updateResult = await client.query(
        `UPDATE rides
         SET status = 'in_progress', started_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND status = 'assigned'
         RETURNING *`,
        [ride_id]
      );

      if (updateResult.rows.length === 0) {
        throw new Error('Ride status changed. Another request may have started it.');
      }

      // Update driver availability (already locked by ride query)
      await client.query(
        'UPDATE drivers SET is_available = false WHERE id = $1',
        [driverId]
      );

      return updateResult.rows[0];
    });

    // Notifications outside transaction
    try {
      await notificationService.notifyUser(
        result.user_id,
        ride_id,
        'Your ride has started. Driver is on the way.'
      );
    } catch (notifError) {
      logger.error('Notification error (non-critical):', notifError);
    }

    res.status(200).json({
      success: true,
      message: 'Ride started successfully',
      data: {
        ride: result,
      },
    });
  } catch (error) {
    logger.error('Error starting ride:', error);
    
    if (error.message === 'RIDE_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Ride not found or not assigned to you',
      });
    }
    
    if (error.message.includes('cannot be started') || error.message.includes('status changed')) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to start ride. Please try again.',
    });
  }
};

// End ride (with row-level locking to prevent race conditions)
const endRide = async (req, res) => {
  const { executeTransaction, query } = require('../config/database');
  
  try {
    const driverId = req.user.id;
    const { ride_id } = req.body;

    const result = await executeTransaction(async (client) => {
      // Lock ride row to prevent concurrent end operations (SELECT FOR UPDATE)
      const rideResult = await client.query(
        'SELECT id, user_id, status, started_at FROM rides WHERE id = $1 AND driver_id = $2 FOR UPDATE',
        [ride_id, driverId]
      );

      if (rideResult.rows.length === 0) {
        throw new Error('RIDE_NOT_FOUND');
      }

      const ride = rideResult.rows[0];

      if (ride.status !== 'in_progress') {
        throw new Error(`Ride cannot be ended. Current status: ${ride.status}`);
      }

      if (!ride.started_at) {
        throw new Error('Ride was not started properly');
      }

      // Calculate duration
      const durationResult = await client.query(
        `SELECT EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at)) / 60 as duration_minutes
         FROM rides WHERE id = $1`,
        [ride_id]
      );
      const durationMinutes = Math.ceil(durationResult.rows[0].duration_minutes);

      // Calculate billing
      const billing = billingService.calculateFare(durationMinutes);

      // Update ride status and billing atomically
      const updateResult = await client.query(
        `UPDATE rides
         SET status = 'completed', 
             ended_at = CURRENT_TIMESTAMP,
             duration_minutes = $1,
             base_fare = $2,
             additional_hours = $3,
             additional_fare = $4,
             total_fare = $5
         WHERE id = $6 AND status = 'in_progress'
         RETURNING *`,
        [
          durationMinutes,
          billing.base_fare,
          billing.additional_hours,
          billing.additional_fare,
          billing.total_fare,
          ride_id,
        ]
      );

      if (updateResult.rows.length === 0) {
        throw new Error('Ride status changed. Another request may have ended it.');
      }

      // Update driver availability
      await client.query(
        'UPDATE drivers SET is_available = true WHERE id = $1',
        [driverId]
      );

      return { ride: updateResult.rows[0], durationMinutes, billing };
    });

    // Notifications outside transaction
    try {
      await notificationService.notifyUser(
        result.ride.user_id,
        ride_id,
        `Your ride has been completed. Total fare: ₹${result.ride.total_fare}`
      );

      const adminResult = await query('SELECT id FROM admin LIMIT 1');
      if (adminResult.rows.length > 0) {
        await notificationService.notifyAdmin(
          adminResult.rows[0].id,
          ride_id,
          `Ride completed. Duration: ${result.durationMinutes} minutes. Fare: ₹${result.ride.total_fare}`
        );
      }
    } catch (notifError) {
      logger.error('Notification error (non-critical):', notifError);
    }

    res.status(200).json({
      success: true,
      message: 'Ride ended successfully',
      data: {
        ride: result.ride,
      },
    });
  } catch (error) {
    logger.error('Error ending ride:', error);
    
    if (error.message === 'RIDE_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Ride not found or not assigned to you',
      });
    }
    
    if (error.message.includes('cannot be ended') || error.message.includes('status changed')) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to end ride. Please try again.',
    });
  }
};

// Get ride history
const getRideHistory = async (req, res) => {
  try {
    const driverId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;

    let queryText = `
      SELECT id, pickup_address, drop_address, status, requested_at, started_at, 
             ended_at, duration_minutes, total_fare
      FROM rides
      WHERE driver_id = $1
    `;
    const params = [driverId];

    if (startDate && endDate) {
      queryText += ` AND ended_at >= $${params.length + 1} AND ended_at <= $${params.length + 2}`;
      params.push(startDate, endDate);
    }

    queryText += ` ORDER BY ended_at DESC NULLS LAST, requested_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    const countResult = await query(
      'SELECT COUNT(*) FROM rides WHERE driver_id = $1',
      [driverId]
    );

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
    logger.error('Error getting ride history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get ride history',
    });
  }
};

// Get daily totals and working hours
const getDailyStats = async (req, res) => {
  try {
    const driverId = req.user.id;
    const date = req.query.date || new Date().toISOString().split('T')[0];

    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const stats = await billingService.getDriverEarnings(
      driverId,
      startDate.toISOString(),
      endDate.toISOString()
    );

    res.status(200).json({
      success: true,
      data: {
        date,
        ...stats,
      },
    });
  } catch (error) {
    logger.error('Error getting daily stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get daily stats',
    });
  }
};

// Get weekly totals and working hours
const getWeeklyStats = async (req, res) => {
  try {
    const driverId = req.user.id;
    const date = req.query.date || new Date().toISOString().split('T')[0];

    // Get start of week (Monday) and end of week (Sunday)
    const startDate = new Date(date);
    const dayOfWeek = startDate.getDay();
    const diff = startDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    startDate.setDate(diff);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);

    const stats = await billingService.getDriverEarnings(
      driverId,
      startDate.toISOString(),
      endDate.toISOString()
    );

    res.status(200).json({
      success: true,
      data: {
        week_start: startDate.toISOString().split('T')[0],
        week_end: endDate.toISOString().split('T')[0],
        ...stats,
      },
    });
  } catch (error) {
    logger.error('Error getting weekly stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get weekly stats',
    });
  }
};

// Get monthly totals and working hours
const getMonthlyStats = async (req, res) => {
  try {
    const driverId = req.user.id;
    const date = req.query.date || new Date().toISOString().split('T')[0];

    // Get start and end of month
    const startDate = new Date(date);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setMonth(startDate.getMonth() + 1);
    endDate.setDate(0);
    endDate.setHours(23, 59, 59, 999);

    const stats = await billingService.getDriverEarnings(
      driverId,
      startDate.toISOString(),
      endDate.toISOString()
    );

    res.status(200).json({
      success: true,
      data: {
        month: startDate.toISOString().split('T')[0],
        ...stats,
      },
    });
  } catch (error) {
    logger.error('Error getting monthly stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get monthly stats',
    });
  }
};

// Get driver profile
const getDriverProfile = async (req, res) => {
  try {
    const driverId = req.user.id;

    const result = await query(
      `SELECT id, name, phone_number, license_number, vehicle_number, 
              is_active, is_available, created_at, last_login
       FROM drivers 
       WHERE id = $1`,
      [driverId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found',
      });
    }

    // Get additional stats
    const statsResult = await query(
      `SELECT COUNT(*) as total_rides,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_rides,
              SUM(total_fare) as total_earnings,
              AVG(total_fare) as avg_fare
       FROM rides 
       WHERE driver_id = $1 AND status = 'completed'`,
      [driverId]
    );

    const driver = result.rows[0];
    const stats = statsResult.rows[0];

    res.status(200).json({
      success: true,
      data: {
        driver: {
          ...driver,
          stats: {
            total_rides: parseInt(stats.total_rides) || 0,
            completed_rides: parseInt(stats.completed_rides) || 0,
            total_earnings: parseFloat(stats.total_earnings) || 0,
            avg_fare: parseFloat(stats.avg_fare) || 0,
          },
        },
      },
    });
  } catch (error) {
    logger.error('Error getting driver profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get driver profile',
    });
  }
};

module.exports = {
  login,
  getAssignedRides,
  startRide,
  endRide,
  getRideHistory,
  getDailyStats,
  getWeeklyStats,
  getMonthlyStats,
  getDriverProfile,
};
