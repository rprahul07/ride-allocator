-- Insert default admin account (password should be hashed in application)
-- Default password: Admin@123 (should be changed in production)
INSERT INTO admin (username, email, phone_number) 
VALUES ('admin', 'admin@rideallocation.com', '+1234567890')
ON CONFLICT (username) DO NOTHING;

-- Note: Admin password hash should be set via application
-- Use bcrypt to hash 'Admin@123' and insert into admin_credentials table
