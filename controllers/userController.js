const { query } = require('../config/database');
const { generateToken } = require('../utils/jwt');
const notificationService = require('../services/notificationService');
const logger = require('../config/logger');

// User login with name and phone number
const login = async (req, res) => {
  try {
    const { phone_number, name } = req.body;

    if (!phone_number) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required',
      });
    }

    // Find or create user
    let userResult = await query(
      'SELECT id, phone_number, name, is_active FROM users WHERE phone_number = $1',
      [phone_number]
    );

    let user;
    if (userResult.rows.length === 0) {
      // Create new user
      const newUser = await query(
        `INSERT INTO users (phone_number, name)
         VALUES ($1, $2)
         RETURNING id, phone_number, name, is_active`,
        [phone_number, name || null]
      );
      user = newUser.rows[0];
      logger.info(`New user created: ${phone_number}`);
    } else {
      user = userResult.rows[0];
      
      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          message: 'Account is inactive',
        });
      }

      // Update name if provided and different
      if (name && name !== user.name) {
        await query(
          'UPDATE users SET name = $1, last_login = CURRENT_TIMESTAMP WHERE id = $2',
          [name, user.id]
        );
        user.name = name;
      } else {
        // Update last login
        await query(
          'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
          [user.id]
        );
      }
    }

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      role: 'user',
      phone_number: user.phone_number,
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          phone_number: user.phone_number,
          name: user.name,
        },
      },
    });
  } catch (error) {
    logger.error('Error in user login:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
    });
  }
};

// Request a ride
const requestRide = async (req, res) => {
  const client = await require('../config/database').getClient();
  
  try {
    const userId = req.user.id;
    const { pickup_address, pickup_latitude, pickup_longitude } = req.body;

    await client.query('BEGIN');

    // Create ride request
    const rideResult = await client.query(
      `INSERT INTO rides (user_id, pickup_address, pickup_latitude, pickup_longitude, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [userId, pickup_address, pickup_latitude || null, pickup_longitude || null]
    );

    const ride = rideResult.rows[0];

    await client.query('COMMIT');

    // Get user phone for notification (after commit to ensure ride exists)
    const userResult = await query(
      'SELECT phone_number FROM users WHERE id = $1',
      [userId]
    );
    const userPhone = userResult.rows[0].phone_number;

    // Notify admin about new ride (outside transaction)
    try {
      await notificationService.notifyAdminNewRide(ride.id, userPhone, pickup_address);
    } catch (notifError) {
      logger.error('Notification error (non-critical):', notifError);
      // Don't fail the request if notification fails
    }

    res.status(201).json({
      success: true,
      message: 'Ride requested successfully. Admin will be notified.',
      data: {
        ride: {
          id: ride.id,
          status: ride.status,
          pickup_address: ride.pickup_address,
          requested_at: ride.requested_at,
        },
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error requesting ride:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to request ride',
    });
  } finally {
    client.release();
  }
};

// Get ride status
const getRideStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { ride_id } = req.params;

    const result = await query(
      `SELECT id, status, pickup_address, requested_at, assigned_at, 
              started_at, ended_at, duration_minutes, total_fare
       FROM rides
       WHERE id = $1 AND user_id = $2`,
      [ride_id, userId]
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
    logger.error('Error getting ride status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get ride status',
    });
  }
};

// Get user's ride history
const getRideHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const result = await query(
      `SELECT id, status, pickup_address, requested_at, started_at, 
              ended_at, duration_minutes, total_fare
       FROM rides
       WHERE user_id = $1
       ORDER BY requested_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) FROM rides WHERE user_id = $1',
      [userId]
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

// Get user notifications
const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const result = await query(
      `SELECT id, type, message, is_read, created_at, ride_id
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.status(200).json({
      success: true,
      data: {
        notifications: result.rows || [],
      },
    });
  } catch (error) {
    logger.error('Error getting notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notifications',
    });
  }
};

module.exports = {
  login,
  requestRide,
  getRideStatus,
  getRideHistory,
  getNotifications,
};
