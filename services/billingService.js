const { query } = require('../config/database');
const logger = require('../config/logger');

const BASE_FARE = parseFloat(process.env.BASE_FARE) || 450;
const BASE_HOURS = parseInt(process.env.BASE_HOURS) || 3;
const ADDITIONAL_HOUR_RATE = parseFloat(process.env.ADDITIONAL_HOUR_RATE) || 100;

// Calculate fare based on duration
const calculateFare = (durationMinutes) => {
  if (!durationMinutes || durationMinutes <= 0) {
    return {
      base_fare: BASE_FARE,
      additional_hours: 0,
      additional_fare: 0,
      total_fare: BASE_FARE,
    };
  }

  const durationHours = durationMinutes / 60;
  
  // First 3 hours: flat ₹450
  if (durationHours <= BASE_HOURS) {
    return {
      base_fare: BASE_FARE,
      additional_hours: 0,
      additional_fare: 0,
      total_fare: BASE_FARE,
    };
  }

  // Additional hours after 3 hours
  const additionalHours = Math.ceil(durationHours - BASE_HOURS);
  const additionalFare = additionalHours * ADDITIONAL_HOUR_RATE;
  const totalFare = BASE_FARE + additionalFare;

  return {
    base_fare: BASE_FARE,
    additional_hours: additionalHours,
    additional_fare: additionalFare,
    total_fare: totalFare,
  };
};

// Update ride billing when ride ends
const updateRideBilling = async (rideId, durationMinutes) => {
  try {
    const billing = calculateFare(durationMinutes);

    const result = await query(
      `UPDATE rides
       SET duration_minutes = $1,
           base_fare = $2,
           additional_hours = $3,
           additional_fare = $4,
           total_fare = $5
       WHERE id = $6
       RETURNING *`,
      [
        durationMinutes,
        billing.base_fare,
        billing.additional_hours,
        billing.additional_fare,
        billing.total_fare,
        rideId,
      ]
    );

    if (result.rows.length === 0) {
      throw new Error('Ride not found');
    }

    return result.rows[0];
  } catch (error) {
    logger.error('Error updating ride billing:', error);
    throw error;
  }
};

// Get driver earnings for a date range
const getDriverEarnings = async (driverId, startDate, endDate) => {
  try {
    const result = await query(
      `SELECT 
         COUNT(*) as total_rides,
         SUM(total_fare) as total_earnings,
         SUM(duration_minutes) as total_minutes,
         SUM(duration_minutes) / 60.0 as total_hours
       FROM rides
       WHERE driver_id = $1
         AND status = 'completed'
         AND ended_at >= $2
         AND ended_at <= $3`,
      [driverId, startDate, endDate]
    );

    return result.rows[0] || {
      total_rides: 0,
      total_earnings: 0,
      total_minutes: 0,
      total_hours: 0,
    };
  } catch (error) {
    logger.error('Error getting driver earnings:', error);
    throw error;
  }
};

module.exports = {
  calculateFare,
  updateRideBilling,
  getDriverEarnings,
};
