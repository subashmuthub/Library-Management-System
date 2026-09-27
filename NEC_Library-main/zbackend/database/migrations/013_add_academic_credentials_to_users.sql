-- ============================================================================
-- Migration: 013_add_academic_credentials_to_users.sql
-- Description: Add degree_type, department, and academic_year to users table
-- ============================================================================

-- Add academic credential columns if not already present
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS degree_type VARCHAR(30) NULL DEFAULT 'BE',
ADD COLUMN IF NOT EXISTS department VARCHAR(50) NULL DEFAULT 'CSE',
ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20) NULL DEFAULT '3rd Year';

-- Backfill existing active student records that have null academic credentials
UPDATE users 
SET 
    degree_type = COALESCE(degree_type, 'BE'),
    department = COALESCE(department, 'CSE'),
    academic_year = COALESCE(academic_year, '3rd Year')
WHERE role_id = 3 OR role_id IS NULL;

-- Sample ME Student / Research Scholar setup for testing access rules
UPDATE users 
SET 
    degree_type = 'ME',
    department = 'CSE',
    academic_year = 'Final Year'
WHERE email LIKE '%pg%' OR email LIKE '%me%' OR id = 5;
