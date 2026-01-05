-- Remove Firebase-related columns and tables

-- Remove firebase_uid column from users table (if exists)
ALTER TABLE users DROP COLUMN IF EXISTS firebase_uid;

-- Drop index on firebase_uid if it exists
DROP INDEX IF EXISTS idx_users_firebase_uid;
