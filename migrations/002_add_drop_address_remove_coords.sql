-- Migration: Add drop_address and remove latitude/longitude columns
-- Date: 2024-01-13

-- Add drop_address column to rides table
ALTER TABLE rides ADD COLUMN IF NOT EXISTS drop_address TEXT;

-- Remove latitude and longitude columns (if they exist)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'rides' AND column_name = 'pickup_latitude'
    ) THEN
        ALTER TABLE rides DROP COLUMN pickup_latitude;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'rides' AND column_name = 'pickup_longitude'
    ) THEN
        ALTER TABLE rides DROP COLUMN pickup_longitude;
    END IF;
END $$;

-- Update existing rides to have default drop_address (optional)
-- This sets drop_address to pickup_address for existing records
-- You can modify this logic as needed
UPDATE rides 
SET drop_address = pickup_address 
WHERE drop_address IS NULL AND pickup_address IS NOT NULL;

-- Add comment to the new column
COMMENT ON COLUMN rides.drop_address IS 'Destination address where the ride should end';
