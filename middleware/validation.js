const { body, validationResult } = require('express-validator');
const logger = require('../config/logger');

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

// User validation rules
const validateUserLogin = [
  body('phone_number')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^\+?[1-9]\d{1,14}$/).withMessage('Invalid phone number format'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 255 }).withMessage('Name must be between 2 and 255 characters'),
  handleValidationErrors,
];

const validateRideRequest = [
  body('pickup_address')
    .trim()
    .notEmpty().withMessage('Pickup address is required')
    .isLength({ min: 5, max: 500 }).withMessage('Address must be between 5 and 500 characters'),
  body('pickup_latitude')
    .optional()
    .isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('pickup_longitude')
    .optional()
    .isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  handleValidationErrors,
];

// Driver validation rules
const validateDriverLogin = [
  body('phone_number')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^\+?[1-9]\d{1,14}$/).withMessage('Invalid phone number format'),
  body('password')
    .trim()
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  handleValidationErrors,
];

// Admin validation rules
const validateAdminLogin = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 100 }).withMessage('Username must be between 3 and 100 characters'),
  body('password')
    .trim()
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  handleValidationErrors,
];

const validateDriverAssignment = [
  body('ride_id')
    .notEmpty().withMessage('Ride ID is required')
    .isUUID().withMessage('Invalid ride ID format'),
  body('driver_id')
    .notEmpty().withMessage('Driver ID is required')
    .isUUID().withMessage('Invalid driver ID format'),
  handleValidationErrors,
];

const validateStartRide = [
  body('ride_id')
    .notEmpty().withMessage('Ride ID is required')
    .isUUID().withMessage('Invalid ride ID format'),
  handleValidationErrors,
];

const validateEndRide = [
  body('ride_id')
    .notEmpty().withMessage('Ride ID is required')
    .isUUID().withMessage('Invalid ride ID format'),
  handleValidationErrors,
];

// Sanitize input
const sanitizeInput = (req, res, next) => {
  // Remove any potential XSS characters
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim();
      }
    });
  }
  next();
};

module.exports = {
  validateUserLogin,
  validateRideRequest,
  validateDriverLogin,
  validateAdminLogin,
  validateDriverAssignment,
  validateStartRide,
  validateEndRide,
  sanitizeInput,
  handleValidationErrors,
};
