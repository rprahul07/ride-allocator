# Postman Collection Guide

## Importing the Collection

1. Open Postman
2. Click **Import** button (top left)
3. Select the file: `Ride_Allocation_API.postman_collection.json`
4. The collection will be imported with all endpoints organized

## Setting Up Environment Variables

The collection uses variables that are automatically set when you use the endpoints. However, you can also create a Postman Environment:

### Create Environment

1. Click **Environments** in the left sidebar
2. Click **+** to create a new environment
3. Name it: `Ride Allocation Local`
4. Add these variables:

| Variable | Initial Value | Current Value |
|----------|---------------|---------------|
| `base_url` | `http://localhost:3000` | `http://localhost:3000` |
| `user_token` | (leave empty) | (auto-set) |
| `driver_token` | (leave empty) | (auto-set) |
| `admin_token` | (leave empty) | (auto-set) |
| `ride_id` | (leave empty) | (auto-set) |
| `driver_id` | (leave empty) | (auto-set) |
| `user_id` | (leave empty) | (auto-set) |
| `active_ride_id` | (leave empty) | (auto-set) |

5. Select this environment from the dropdown (top right)

## Collection Structure

### 1. Health Check
- **Health Check**: Verify server is running

### 2. User APIs

#### Authentication
- **Request OTP**: Send OTP to phone number
  - Body: `{"phone_number": "+1234567890"}`
- **Verify OTP & Login**: Verify OTP and get JWT token
  - Body: `{"phone_number": "+1234567890", "otp": "123456"}`
  - ⚠️ Automatically saves `user_token` to environment

#### Rides
- **Request Ride**: Create a new ride request
  - Requires: `user_token` (Bearer token)
  - Body: `{"pickup_address": "...", "pickup_latitude": 40.7128, "pickup_longitude": -74.0060}`
  - ⚠️ Automatically saves `ride_id` to environment
- **Get Ride Status**: Check ride status
  - Requires: `user_token`
  - Uses: `ride_id` from environment
- **Get Ride History**: Get user's ride history
  - Requires: `user_token`
  - Query params: `limit`, `offset`

#### Notifications
- **Get Notifications**: Get user notifications
  - Requires: `user_token`
  - Query params: `limit`, `offset`

### 3. Driver APIs

#### Authentication
- **Driver Login**: Login with phone and password
  - Body: `{"phone_number": "+1987654321", "password": "Driver@123"}`
  - ⚠️ Automatically saves `driver_token` and `driver_id` to environment

#### Rides
- **Get Assigned Rides**: Get rides assigned to driver
  - Requires: `driver_token`
- **Start Ride**: Start a ride (begins billing timer)
  - Requires: `driver_token`
  - Body: `{"ride_id": "..."}`
  - ⚠️ Automatically saves `active_ride_id` to environment
- **End Ride**: End a ride (calculates billing)
  - Requires: `driver_token`
  - Body: `{"ride_id": "..."}`
  - Uses: `active_ride_id` from environment
- **Get Ride History**: Get driver's ride history
  - Requires: `driver_token`
  - Query params: `limit`, `offset`, `start_date`, `end_date`

#### Statistics
- **Get Daily Stats**: Get daily earnings and statistics
  - Requires: `driver_token`
  - Query params: `date` (optional, defaults to today)

### 4. Admin APIs

#### Authentication
- **Admin Login**: Login with username and password
  - Body: `{"username": "admin", "password": "Admin@123"}`
  - ⚠️ Automatically saves `admin_token` and `admin_id` to environment

#### Ride Management
- **Get Pending Rides**: Get all pending ride requests
  - Requires: `admin_token`
- **Get All Rides**: Get all rides with filters
  - Requires: `admin_token`
  - Query params: `status`, `limit`, `offset`, `start_date`, `end_date`
- **Get Live Rides**: Get active rides (assigned or in_progress)
  - Requires: `admin_token`
- **Get Ride Details**: Get detailed ride information
  - Requires: `admin_token`
  - Uses: `ride_id` from environment
- **Assign Driver to Ride**: Assign driver to pending ride
  - Requires: `admin_token`
  - Body: `{"ride_id": "...", "driver_id": "..."}`
  - Uses: `ride_id` and `driver_id` from environment

#### Driver Management
- **Get Available Drivers**: Get drivers available for assignment
  - Requires: `admin_token`
- **Get Driver Performance**: Get driver statistics
  - Requires: `admin_token`
  - Query params: `driver_id`, `start_date`, `end_date`

## Testing Workflow

### Complete User Flow

1. **Health Check** → Verify server is running
2. **User: Request OTP** → Get OTP code (check console/logs in dev mode)
3. **User: Verify OTP & Login** → Get `user_token`
4. **User: Request Ride** → Create ride, get `ride_id`
5. **Admin: Admin Login** → Get `admin_token`
6. **Admin: Get Pending Rides** → See the ride you just created
7. **Admin: Get Available Drivers** → See available drivers, note a `driver_id`
8. **Admin: Assign Driver to Ride** → Assign driver using `ride_id` and `driver_id`
9. **Driver: Driver Login** → Get `driver_token`
10. **Driver: Get Assigned Rides** → See the assigned ride
11. **Driver: Start Ride** → Start the ride (timer begins)
12. **Wait a few seconds** (or minutes for testing billing)
13. **Driver: End Ride** → End ride, billing is calculated
14. **User: Get Ride Status** → See completed ride with billing
15. **Admin: Get All Rides** → See completed ride in history

### Quick Test Flow

1. Login as User → Get token
2. Request Ride → Get ride_id
3. Login as Admin → Get token
4. Get Available Drivers → Get driver_id
5. Assign Driver → Use ride_id and driver_id
6. Login as Driver → Get token
7. Start Ride → Use ride_id
8. End Ride → Use ride_id
9. Check billing in User: Get Ride Status

## Request Body Examples

### User Request Ride
```json
{
  "pickup_address": "123 Main Street, Downtown, City 12345",
  "pickup_latitude": 40.7128,
  "pickup_longitude": -74.0060
}
```

### Driver Start/End Ride
```json
{
  "ride_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Admin Assign Driver
```json
{
  "ride_id": "550e8400-e29b-41d4-a716-446655440000",
  "driver_id": "660e8400-e29b-41d4-a716-446655440001"
}
```

## Authentication

All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <token>
```

The collection automatically handles this for you when you use the saved tokens.

## Tips

1. **Auto-saved Tokens**: Login endpoints automatically save tokens to environment variables
2. **Auto-saved IDs**: Some endpoints automatically save IDs (ride_id, driver_id) for use in subsequent requests
3. **Update Variables**: If you need to manually set variables, go to the collection variables or environment
4. **Test Scripts**: Some requests have test scripts that automatically extract and save values
5. **Error Responses**: Check the response body for detailed error messages

## Common Issues

### 401 Unauthorized
- Token expired or invalid
- Solution: Re-login to get a new token

### 403 Forbidden
- Wrong role or account inactive
- Solution: Use correct user type (user/driver/admin)

### 404 Not Found
- Invalid ID or resource doesn't exist
- Solution: Check the ID in the request

### 400 Bad Request
- Validation error
- Solution: Check request body format and required fields

### 429 Too Many Requests
- Rate limit exceeded
- Solution: Wait a few minutes before retrying

## Environment-Specific URLs

For different environments, update the `base_url` variable:

- **Local**: `http://localhost:3000`
- **Development**: `https://dev-api.example.com`
- **Production**: `https://api.example.com`
