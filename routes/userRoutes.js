const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, verifyRole } = require('../middleware/auth');
const {
  validateUserLogin,
  validateRideRequest,
  sanitizeInput,
} = require('../middleware/validation');
const { authLimiter, apiLimiter } = require('../middleware/security');

// Public routes - Simple login with name and phone
router.post(
  '/login',
  authLimiter,
  sanitizeInput,
  validateUserLogin,
  userController.login
);

// Protected routes
router.use(verifyToken);
router.use(verifyRole('user'));

router.post(
  '/rides/request',
  apiLimiter,
  sanitizeInput,
  validateRideRequest,
  userController.requestRide
);

router.get('/rides/:ride_id/status', apiLimiter, userController.getRideStatus);

router.get('/rides/history', apiLimiter, userController.getRideHistory);

router.get('/notifications', apiLimiter, userController.getNotifications);

router.get('/profile', apiLimiter, userController.getUserProfile);

router.delete('/rides/:ride_id', apiLimiter, userController.cancelRide);

module.exports = router;
