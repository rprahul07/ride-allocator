-- Add firebase_uid column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(255) UNIQUE;

-- Create index on firebase_uid for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);

-- Drop OTP verification table (no longer needed with Firebase)
DROP TABLE IF EXISTS otp_verification;

-- Drop index on otp_verification if it exists
DROP INDEX IF EXISTS idx_otp_phone;
