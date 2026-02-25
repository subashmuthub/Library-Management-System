-- Update foreign key constraints to allow CASCADE delete for books
-- This allows books to be deleted even with related records

USE smart_library;

-- Drop and recreate book_transactions foreign key with CASCADE
ALTER TABLE book_transactions DROP FOREIGN KEY book_transactions_ibfk_2;
ALTER TABLE book_transactions ADD CONSTRAINT book_transactions_ibfk_2 
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop and recreate reservations foreign key with CASCADE
ALTER TABLE reservations DROP FOREIGN KEY reservations_ibfk_2;
ALTER TABLE reservations ADD CONSTRAINT reservations_ibfk_2 
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop and recreate book_location_history foreign key with CASCADE
ALTER TABLE book_location_history DROP FOREIGN KEY book_location_history_ibfk_1;
ALTER TABLE book_location_history ADD CONSTRAINT book_location_history_ibfk_1 
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- rfid_tags already has CASCADE (check schema)
-- But let's ensure it's set correctly
ALTER TABLE rfid_tags DROP FOREIGN KEY rfid_tags_ibfk_1;
ALTER TABLE rfid_tags ADD CONSTRAINT rfid_tags_ibfk_1 
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE ON UPDATE CASCADE;

SELECT 'All foreign key constraints updated with CASCADE delete' as status;