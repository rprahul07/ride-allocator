const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const logger = require('../config/logger');

// Verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      next();
    } catch (error) {
      logger.error('Token verification failed:', error);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token.',
      });
    }
  } catch (error) {
    logger.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error.',
    });
  }
};

// Verify user role
const verifyRole = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required.',
        });
      }

      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Insufficient permissions.',
        });
      }

      // Verify user still exists and is active
      let userQuery;
      if (req.user.role === 'user') {
        userQuery = 'SELECT id, is_active FROM users WHERE id = $1';
      } else if (req.user.role === 'driver') {
        userQuery = 'SELECT id, is_active FROM drivers WHERE id = $1';
      } else if (req.user.role === 'admin') {
        userQuery = 'SELECT id FROM admin WHERE id = $1';
      }

      if (userQuery) {
        const result = await query(userQuery, [req.user.id]);
        if (result.rows.length === 0) {
          return res.status(401).json({
            success: false,
            message: 'User not found.',
          });
        }

        if (req.user.role !== 'admin' && !result.rows[0].is_active) {
          return res.status(403).json({
            success: false,
            message: 'Account is inactive.',
          });
        }
      }

      next();
    } catch (error) {
      logger.error('Role verification error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authorization error.',
      });
    }
  };
};

module.exports = {
  verifyToken,
  verifyRole,
};
