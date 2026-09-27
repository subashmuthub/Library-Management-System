-- Remove UNIQUE constraint from ISBN to allow duplicate books
-- This allows importing the same book multiple times

USE smart_library;

-- Drop the unique index on ISBN
ALTER TABLE books DROP INDEX isbn;

-- Recreate as regular index (not unique)
ALTER TABLE books ADD INDEX idx_isbn_non_unique (isbn);

-- Verify the change
SHOW INDEX FROM books WHERE Key_name LIKE '%isbn%';

SELECT 'ISBN constraint removed - duplicate books now allowed' as status;