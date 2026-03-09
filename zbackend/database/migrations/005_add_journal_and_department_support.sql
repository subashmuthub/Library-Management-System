-- ============================================================================
-- Migration: Add Journal Support and Department Filters
-- Date: February 26, 2026
-- Description: Add type field to distinguish books/journals, add department field
-- ============================================================================

USE smart_library;

-- Add type field to books table (book or journal)
ALTER TABLE books 
ADD COLUMN type ENUM('book', 'journal') NOT NULL DEFAULT 'book' AFTER id;

-- Add department field for filtering
ALTER TABLE books 
ADD COLUMN department VARCHAR(100) NULL AFTER category;

-- Add index for better search performance
ALTER TABLE books 
ADD INDEX idx_type (type);

ALTER TABLE books 
ADD INDEX idx_department (department);

-- Update FULLTEXT index to include department
ALTER TABLE books
DROP INDEX idx_search;

ALTER TABLE books
ADD FULLTEXT idx_search (title, author, description, department);

-- Add department to users table for personalized filtering
ALTER TABLE users 
ADD COLUMN department VARCHAR(100) NULL AFTER student_id;

ALTER TABLE users 
ADD INDEX idx_department (department);

COMMIT;
