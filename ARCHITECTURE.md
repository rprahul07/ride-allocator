# System Architecture

## Overview

This is a secure, admin-controlled ride allocation system with three separate applications (User, Driver, Admin) that communicate through a centralized Express.js backend with PostgreSQL database.

## Architecture Principles

1. **Admin as Single Point of Control**: All ride allocations are managed by admin
2. **Anonymity**: Users and drivers never directly communicate
3. **Server-Side Timing**: Ride duration is calculated server-side for accuracy
4. **Security First**: Multiple layers of security throughout the system

## System Components

### 1. Database Layer (PostgreSQL)

**Tables:**
- `users` - User accounts (phone-based)
- `drivers` - Driver accounts
- `admin` - Single admin account
- `rides` - Ride records with billing information
- `otp_verification` - OTP codes for user authentication
- `notifications` - System notifications
- `driver_credentials` - Hashed driver passwords
- `admin_credentials` - Hashed admin password

**Security Features:**
- UUID primary keys
- Foreign key constraints
- Indexes for performance
- Automatic timestamp updates via triggers

### 2. Authentication & Authorization

**User Authentication:**
- OTP-based (6-digit code via SMS)
- OTP expires after 10 minutes
- Maximum 5 verification attempts
- JWT token issued upon successful verification

**Driver Authentication:**
- Username (phone) + password
- Bcrypt password hashing (12 rounds)
- JWT token issued upon successful login

**Admin Authentication:**
- Username + password
- Bcrypt password hashing (12 rounds)
- JWT token issued upon successful login

**Authorization:**
- Role-based access control (user, driver, admin)
- JWT token verification on all protected routes
- Role verification middleware
- Account status checks (active/inactive)

### 3. Security Middleware

**Rate Limiting:**
- Authentication endpoints: 5 requests per 15 minutes
- OTP requests: 3 requests per 15 minutes
- General API: 100 requests per 15 minutes

**Input Validation:**
- Express-validator for all inputs
- Phone number format validation
- UUID validation for IDs
- Coordinate validation for GPS
- Input sanitization

**Security Headers:**
- Helmet.js for security headers
- CORS configuration
- Content Security Policy

**Error Handling:**
- Centralized error handler
- No sensitive information in error messages (production)
- Proper HTTP status codes
- Error logging

### 4. Business Logic

**Ride Workflow:**
1. User requests ride → Status: `pending`
2. Admin assigns driver → Status: `assigned`
3. Driver starts ride → Status: `in_progress` (timer starts)
4. Driver ends ride → Status: `completed` (billing calculated)

**Billing Calculation:**
- Base fare: ₹450 for first 3 hours
- Additional: ₹100 per hour after 3 hours
- Server-side calculation based on actual duration
- Stored in database for audit trail

**Notifications:**
- Database notifications for all parties
- Phone call to admin on new ride request (Twilio)
- SMS notifications for OTP (Twilio)

### 5. API Structure

**User Endpoints:**
- `/api/users/login/request-otp` - Request OTP
- `/api/users/login/verify-otp` - Verify OTP & login
- `/api/users/rides/request` - Request ride
- `/api/users/rides/:ride_id/status` - Get ride status
- `/api/users/rides/history` - Ride history
- `/api/users/notifications` - Get notifications

**Driver Endpoints:**
- `/api/drivers/login` - Driver login
- `/api/drivers/rides/assigned` - Get assigned rides
- `/api/drivers/rides/start` - Start ride
- `/api/drivers/rides/end` - End ride
- `/api/drivers/rides/history` - Ride history
- `/api/drivers/stats/daily` - Daily statistics

**Admin Endpoints:**
- `/api/admin/login` - Admin login
- `/api/admin/rides/pending` - Get pending rides
- `/api/admin/drivers/available` - Get available drivers
- `/api/admin/rides/assign` - Assign driver
- `/api/admin/rides/all` - Get all rides
- `/api/admin/rides/live` - Get live rides
- `/api/admin/rides/:ride_id` - Get ride details
- `/api/admin/drivers/performance` - Driver performance

## Security Features

### 1. Authentication Security
- Strong password hashing (bcrypt, 12 rounds)
- JWT tokens with expiration
- OTP with expiry and attempt limits
- Secure token storage (not in localStorage recommendations)

### 2. Authorization Security
- Role-based access control
- Route-level authorization
- Account status verification
- Token validation on every request

### 3. Input Security
- Input validation and sanitization
- SQL injection prevention (parameterized queries)
- XSS prevention (input sanitization)
- Type validation

### 4. Rate Limiting
- Prevents brute force attacks
- Prevents API abuse
- Configurable limits per endpoint type

### 5. Data Security
- Password hashing (never stored in plain text)
- Sensitive data not exposed in errors
- Database connection pooling
- Transaction support for critical operations

### 6. Communication Security
- HTTPS recommended (configure at reverse proxy level)
- CORS configuration
- Security headers via Helmet

## Error Handling

**Error Types:**
- Validation errors (400)
- Authentication errors (401)
- Authorization errors (403)
- Not found errors (404)
- Database errors (409, 500)
- Server errors (500)

**Error Response Format:**
```json
{
  "success": false,
  "message": "Error message",
  "errors": [] // Only in development
}
```

## Logging

- Winston logger for structured logging
- Log levels: error, warn, info
- File logging: error.log, combined.log
- Console logging in development
- Request logging with IP and user agent

## Database Transactions

Critical operations use database transactions:
- Ride assignment
- Ride start/end
- Billing updates

This ensures data consistency and prevents race conditions.

## Scalability Considerations

- Database connection pooling
- Indexed queries for performance
- Pagination support on list endpoints
- Efficient query patterns
- Stateless API design (JWT tokens)

## Future Enhancements

Potential improvements:
- Redis for session management
- Message queue for notifications
- Caching layer for frequently accessed data
- WebSocket support for real-time updates
- Database read replicas for read-heavy operations
- Microservices architecture for scale
