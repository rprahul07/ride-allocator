const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, verifyRole } = require('../middleware/auth');
const {
  validateAdminLogin,
  validateDriverAssignment,
  sanitizeInput,
} = require('../middleware/validation');
const { authLimiter, apiLimiter } = require('../middleware/security');

// Public routes
router.post(
  '/login',
  authLimiter,
  sanitizeInput,
  validateAdminLogin,
  adminController.login
);

// Protected routes
router.use(verifyToken);
router.use(verifyRole('admin'));

router.get('/rides/pending', apiLimiter, adminController.getPendingRides);

router.get('/drivers/available', apiLimiter, adminController.getAvailableDrivers);

router.post(
  '/rides/assign',
  apiLimiter,
  sanitizeInput,
  validateDriverAssignment,
  adminController.assignDriver
);

router.get('/rides/all', apiLimiter, adminController.getAllRides);

router.get('/rides/live', apiLimiter, adminController.getLiveRides);

router.get('/rides/:ride_id', apiLimiter, adminController.getRideDetails);

router.get('/drivers/performance', apiLimiter, adminController.getDriverPerformance);

module.exports = router;
