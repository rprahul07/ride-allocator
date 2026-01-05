const express = require('express');
const router = express.Router();

// Notification routes (Twilio removed - kept for future webhook integrations)
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Notification service is active',
  });
});

module.exports = router;
