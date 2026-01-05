# Ride Allocation & Time-Based Billing System

A secure, admin-controlled ride allocation system with time-based billing, built with Express.js and PostgreSQL.

## Features

- **Three Application Types**: User App, Driver App, and Admin App
- **OTP Authentication**: Mobile number-based login for users
- **Admin-Controlled Allocation**: Admin manually assigns drivers to rides
- **Time-Based Billing**: ₹450 for first 3 hours, ₹100/hour thereafter
- **Server-Side Timing**: Accurate ride duration tracking
- **Anonymity**: Users and drivers remain anonymous to each other
- **Security**: JWT authentication, rate limiting, input validation, and more

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- Twilio account (for OTP and phone calls - optional for development)

## Installation

1. Clone the repository and navigate to the project directory:
```bash
cd backend_
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file from `.env.example`:
```bash
cp .env.example .env
```

4. Update `.env` with your configuration:
   - Database credentials
   - JWT secret (use a strong random string)
   - Twilio credentials (optional for development)

5. Create PostgreSQL database:
```sql
CREATE DATABASE ride_allocation_db;
```

6. Run migrations to set up the database schema:
```bash
npm run migrate
```

This will:
- Create all necessary tables
- Set up indexes and triggers
- Create default admin account (username: `admin`, password: `Admin@123`)

## Creating Drivers

To create a driver account, use the provided script:

```bash
node scripts/createDriver.js <phone_number> <name> <password> [license_number] [vehicle_number]
```

Example:
```bash
node scripts/createDriver.js +1234567890 "John Doe" "Driver@123" "DL123456" "ABC1234"
```

## Running the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will run on `http://localhost:3000` (or the port specified in `.env`).

## API Endpoints

### User Endpoints

- `POST /api/users/login/request-otp` - Request OTP for login
- `POST /api/users/login/verify-otp` - Verify OTP and login
- `POST /api/users/rides/request` - Request a new ride
- `GET /api/users/rides/:ride_id/status` - Get ride status
- `GET /api/users/rides/history` - Get ride history
- `GET /api/users/notifications` - Get notifications

### Driver Endpoints

- `POST /api/drivers/login` - Driver login
- `GET /api/drivers/rides/assigned` - Get assigned rides
- `POST /api/drivers/rides/start` - Start a ride
- `POST /api/drivers/rides/end` - End a ride
- `GET /api/drivers/rides/history` - Get ride history
- `GET /api/drivers/stats/daily` - Get daily statistics

### Admin Endpoints

- `POST /api/admin/login` - Admin login
- `GET /api/admin/rides/pending` - Get pending ride requests
- `GET /api/admin/drivers/available` - Get available drivers
- `POST /api/admin/rides/assign` - Assign driver to ride
- `GET /api/admin/rides/all` - Get all rides (with filters)
- `GET /api/admin/rides/live` - Get live/active rides
- `GET /api/admin/rides/:ride_id` - Get ride details
- `GET /api/admin/drivers/performance` - Get driver performance stats

## Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Billing Logic

- **Base Fare**: ₹450 for the first 3 hours
- **Additional Hours**: ₹100 per hour after the initial 3 hours
- **Calculation**: Server-side based on actual ride duration

Example:
- 2 hours: ₹450
- 4 hours: ₹450 + (1 × ₹100) = ₹550
- 6 hours: ₹450 + (3 × ₹100) = ₹750

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Prevents brute force attacks
- **Input Validation**: All inputs are validated and sanitized
- **SQL Injection Protection**: Parameterized queries
- **Helmet**: Security headers
- **CORS**: Configurable cross-origin resource sharing
- **Error Handling**: Comprehensive error handling without exposing sensitive information

## Database Schema

Key tables:
- `users` - User accounts
- `drivers` - Driver accounts
- `admin` - Admin account
- `rides` - Ride records
- `otp_verification` - OTP codes
- `notifications` - System notifications
- `driver_credentials` - Driver passwords (hashed)
- `admin_credentials` - Admin password (hashed)

## Environment Variables

See `.env.example` for all available configuration options.

## Development Notes

- In development mode, OTP codes are logged to console if Twilio is not configured
- Admin phone calls are skipped if Twilio is not configured
- Default admin credentials: `admin` / `Admin@123` (change in production!)

## Production Checklist

- [ ] Change default admin password
- [ ] Set strong JWT_SECRET
- [ ] Configure Twilio for OTP and phone calls
- [ ] Set NODE_ENV=production
- [ ] Configure proper CORS origins
- [ ] Set up SSL/TLS
- [ ] Configure database connection pooling
- [ ] Set up logging and monitoring
- [ ] Enable database backups

## License

ISC
