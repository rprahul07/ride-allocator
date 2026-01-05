# Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Database Setup

Create a PostgreSQL database:
```sql
CREATE DATABASE ride_allocation_db;
```

Or using psql command line:
```bash
createdb ride_allocation_db
```

### 3. Environment Configuration

Copy `env.example` to `.env`:
```bash
cp env.example .env
```

Edit `.env` and update:
- Database credentials (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)
- JWT_SECRET (generate a strong random string)
- Twilio credentials (optional for development)

### 4. Run Migrations

This will create all tables and set up the default admin account:
```bash
npm run migrate
```

Default admin credentials:
- Username: `admin`
- Password: `Admin@123`

**⚠️ IMPORTANT: Change the admin password in production!**

### 5. Create Driver Accounts

Use the provided script to create driver accounts:
```bash
node scripts/createDriver.js <phone_number> <name> <password> [license_number] [vehicle_number]
```

Example:
```bash
node scripts/createDriver.js +1234567890 "John Doe" "Driver@123" "DL123456" "ABC1234"
```

### 6. Start the Server

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## Testing the API

### Health Check
```bash
curl http://localhost:3000/health
```

### User Flow

1. **Request OTP:**
```bash
curl -X POST http://localhost:3000/api/users/login/request-otp \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+1234567890"}'
```

2. **Verify OTP and Login:**
```bash
curl -X POST http://localhost:3000/api/users/login/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+1234567890", "otp": "123456"}'
```

3. **Request Ride:**
```bash
curl -X POST http://localhost:3000/api/users/rides/request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "pickup_address": "123 Main St, City",
    "pickup_latitude": 40.7128,
    "pickup_longitude": -74.0060
  }'
```

### Driver Flow

1. **Login:**
```bash
curl -X POST http://localhost:3000/api/drivers/login \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+1234567890", "password": "Driver@123"}'
```

2. **Get Assigned Rides:**
```bash
curl http://localhost:3000/api/drivers/rides/assigned \
  -H "Authorization: Bearer <token>"
```

3. **Start Ride:**
```bash
curl -X POST http://localhost:3000/api/drivers/rides/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"ride_id": "<ride_id>"}'
```

4. **End Ride:**
```bash
curl -X POST http://localhost:3000/api/drivers/rides/end \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"ride_id": "<ride_id>"}'
```

### Admin Flow

1. **Login:**
```bash
curl -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "Admin@123"}'
```

2. **Get Pending Rides:**
```bash
curl http://localhost:3000/api/admin/rides/pending \
  -H "Authorization: Bearer <token>"
```

3. **Get Available Drivers:**
```bash
curl http://localhost:3000/api/admin/drivers/available \
  -H "Authorization: Bearer <token>"
```

4. **Assign Driver:**
```bash
curl -X POST http://localhost:3000/api/admin/rides/assign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "ride_id": "<ride_id>",
    "driver_id": "<driver_id>"
  }'
```

## Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running
- Check database credentials in `.env`
- Ensure database exists

### OTP Not Working
- In development, OTP codes are logged to console if Twilio is not configured
- Check Twilio credentials in `.env` for production

### Migration Errors
- Ensure database is empty or drop existing tables
- Check PostgreSQL user has CREATE privileges

### Port Already in Use
- Change PORT in `.env`
- Or kill the process using the port

## Production Checklist

- [ ] Change default admin password
- [ ] Set strong JWT_SECRET (use: `openssl rand -base64 32`)
- [ ] Configure Twilio for OTP and phone calls
- [ ] Set NODE_ENV=production
- [ ] Configure proper CORS origins
- [ ] Set up SSL/TLS (use reverse proxy like nginx)
- [ ] Configure database connection pooling
- [ ] Set up logging and monitoring
- [ ] Enable database backups
- [ ] Set up process manager (PM2)
- [ ] Configure firewall rules
- [ ] Review and update rate limits
