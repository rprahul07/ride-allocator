const { query } = require('../config/database');
const logger = require('../config/logger');

// Create notification in database
const createNotification = async (data) => {
  try {
    const { ride_id, user_id, driver_id, admin_id, type, message } = data;
    
    const result = await query(
      `INSERT INTO notifications (ride_id, user_id, driver_id, admin_id, type, message)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, created_at`,
      [ride_id, user_id, driver_id, admin_id, type, message]
    );

    return result.rows[0];
  } catch (error) {
    logger.error('Error creating notification:', error);
    throw error;
  }
};

// Notify admin about new ride request (Twilio removed - just create notification)
const notifyAdminNewRide = async (rideId, userPhone, pickupAddress) => {
  try {
    // Create notification for admin about new ride
    await createNotification({
      ride_id: rideId,
      admin_id: null,
      type: 'new_ride_request',
      message: `New ride request from ${userPhone}. Pickup: ${pickupAddress}`,
    });

    logger.info(`Admin notified about new ride: ${rideId}`);
    return { success: true };
  } catch (error) {
    logger.error('Error notifying admin:', error);
    // Don't throw error, just log it
    return { success: false, message: 'Failed to notify admin' };
  }
};

// Notify user about ride status
const notifyUser = async (userId, rideId, message, type = 'ride_update') => {
  try {
    await createNotification({
      ride_id: rideId,
      user_id: userId,
      type,
      message,
    });
    return { success: true };
  } catch (error) {
    logger.error('Error notifying user:', error);
    throw error;
  }
};

// Notify driver about assignment
const notifyDriver = async (driverId, rideId, message) => {
  try {
    await createNotification({
      ride_id: rideId,
      driver_id: driverId,
      type: 'ride_assigned',
      message,
    });
    return { success: true };
  } catch (error) {
    logger.error('Error notifying driver:', error);
    throw error;
  }
};

// Notify admin about ride updates
const notifyAdmin = async (adminId, rideId, message, type = 'ride_update') => {
  try {
    await createNotification({
      ride_id: rideId,
      admin_id: adminId,
      type,
      message,
    });
    return { success: true };
  } catch (error) {
    logger.error('Error notifying admin:', error);
    throw error;
  }
};

module.exports = {
  createNotification,
  notifyAdminNewRide,
  notifyUser,
  notifyDriver,
  notifyAdmin,
};
