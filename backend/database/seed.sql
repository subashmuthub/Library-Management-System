-- ============================================================================
-- Smart Library Automation System - Sample Test Data
-- ============================================================================
-- This file populates the database with realistic test data for development
-- and demonstration purposes.
-- ============================================================================

USE smart_library;

-- Disable foreign key checks temporarily for easier insertion
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- USERS
-- Password for all users: "password123" (hashed with bcrypt)
-- ============================================================================
INSERT INTO users (email, password_hash, first_name, last_name, role, student_id, phone) VALUES
-- Admins
('admin@library.edu', '$2a$10$FV/63tlTpuYiWI1Wf0PyF.wWiBeC8i2NmGBEyQivREFuJS1zQveRu', 'Alice', 'Admin', 'admin', NULL, '555-0001'),

-- Librarians
('librarian1@library.edu', '$2a$10$FV/63tlTpuYiWI1Wf0PyF.wWiBeC8i2NmGBEyQivREFuJS1zQveRu', 'Bob', 'Librarian', 'librarian', NULL, '555-0002'),
('librarian2@library.edu', '$2a$10$FV/63tlTpuYiWI1Wf0PyF.wWiBeC8i2NmGBEyQivREFuJS1zQveRu', 'Carol', 'Books', 'librarian', NULL, '555-0003'),

-- Students
('student1@university.edu', '$2a$10$FV/63tlTpuYiWI1Wf0PyF.wWiBeC8i2NmGBEyQivREFuJS1zQveRu', 'David', 'Student', 'student', 'STU001', '555-1001'),
('student2@university.edu', '$2a$10$FV/63tlTpuYiWI1Wf0PyF.wWiBeC8i2NmGBEyQivREFuJS1zQveRu', 'Emma', 'Scholar', 'student', 'STU002', '555-1002'),
('student3@university.edu', '$2a$10$FV/63tlTpuYiWI1Wf0PyF.wWiBeC8i2NmGBEyQivREFuJS1zQveRu', 'Frank', 'Reader', 'student', 'STU003', '555-1003'),
('student4@university.edu', '$2a$10$FV/63tlTpuYiWI1Wf0PyF.wWiBeC8i2NmGBEyQivREFuJS1zQveRu', 'Grace', 'Learner', 'student', 'STU004', '555-1004'),
('student5@university.edu', '$2a$10$FV/63tlTpuYiWI1Wf0PyF.wWiBeC8i2NmGBEyQivREFuJS1zQveRu', 'Henry', 'Bookworm', 'student', 'STU005', '555-1005');

-- ============================================================================
-- SHELVES
-- ============================================================================
INSERT INTO shelves (shelf_code, zone, floor, section, capacity, description) VALUES
-- Zone A (Fiction)
('A1', 'A', 1, 'Fiction', 100, 'Classic Literature'),
('A2', 'A', 1, 'Fiction', 100, 'Modern Fiction'),
('A3', 'A', 1, 'Fiction', 100, 'Science Fiction'),
('A4', 'A', 1, 'Fiction', 100, 'Fantasy'),
('A5', 'A', 1, 'Fiction', 100, 'Mystery & Thriller'),

-- Zone B (Non-Fiction)
('B1', 'B', 1, 'Non-Fiction', 100, 'History'),
('B2', 'B', 1, 'Non-Fiction', 100, 'Biography'),
('B3', 'B', 1, 'Non-Fiction', 100, 'Science'),
('B4', 'B', 1, 'Non-Fiction', 100, 'Technology'),
('B5', 'B', 1, 'Non-Fiction', 100, 'Business'),

-- Zone C (Academic)
('C1', 'C', 2, 'Academic', 150, 'Computer Science'),
('C2', 'C', 2, 'Academic', 150, 'Engineering'),
('C3', 'C', 2, 'Academic', 150, 'Mathematics'),
('C4', 'C', 2, 'Academic', 150, 'Physics'),
('C5', 'C', 2, 'Academic', 150, 'Chemistry');

-- ============================================================================
-- READERS
-- ============================================================================
INSERT INTO readers (reader_code, reader_type, shelf_id, is_active) VALUES
-- Demo mode: 1 handheld reader
('HANDHELD-001', 'handheld', NULL, TRUE),

-- Production mode: Fixed readers at each shelf
('FIXED-A1', 'fixed', 1, TRUE),
('FIXED-A2', 'fixed', 2, TRUE),
('FIXED-A3', 'fixed', 3, TRUE),
('FIXED-A4', 'fixed', 4, TRUE),
('FIXED-A5', 'fixed', 5, TRUE),
('FIXED-B1', 'fixed', 6, TRUE),
('FIXED-B2', 'fixed', 7, TRUE),
('FIXED-B3', 'fixed', 8, TRUE),
('FIXED-B4', 'fixed', 9, TRUE),
('FIXED-B5', 'fixed', 10, TRUE),
('FIXED-C1', 'fixed', 11, TRUE),
('FIXED-C2', 'fixed', 12, TRUE),
('FIXED-C3', 'fixed', 13, TRUE),
('FIXED-C4', 'fixed', 14, TRUE),
('FIXED-C5', 'fixed', 15, TRUE);

-- ============================================================================
-- BEACONS
-- ============================================================================
INSERT INTO beacons (beacon_uuid, major, minor, zone, location_description, battery_level) VALUES
('f7826da6-4fa2-4e98-8024-bc5b71e0893e', 100, 1, 'A', 'Zone A - Fiction Section', 85),
('a8937eb7-5gb3-5f09-9135-cd6c82f1904f', 100, 2, 'B', 'Zone B - Non-Fiction Section', 78),
('b9048fc8-6hc4-6g10-0246-de7d93g2015g', 100, 3, 'C', 'Zone C - Academic Section (Floor 2)', 92);

-- ============================================================================
-- BOOKS
-- ============================================================================
INSERT INTO books (isbn, title, author, publisher, publication_year, category, edition, pages) VALUES
-- Fiction (Zone A)
('9780141439518', 'Pride and Prejudice', 'Jane Austen', 'Penguin Classics', 2003, 'Fiction', 'Revised', 480),
('9780060935467', 'To Kill a Mockingbird', 'Harper Lee', 'Harper Perennial', 2006, 'Fiction', 'Reprint', 336),
('9780451524935', '1984', 'George Orwell', 'Signet Classic', 1961, 'Fiction', 'Mass Market', 328),
('9780316769488', 'The Catcher in the Rye', 'J.D. Salinger', 'Little, Brown', 2001, 'Fiction', 'Reissue', 277),
('9780544003415', 'The Lord of the Rings', 'J.R.R. Tolkien', 'Mariner Books', 2012, 'Fantasy', 'Reissue', 1178),
('9780439139595', 'Harry Potter and the Goblet of Fire', 'J.K. Rowling', 'Scholastic', 2002, 'Fantasy', '1st', 734),
('9780553293357', 'Foundation', 'Isaac Asimov', 'Bantam', 1991, 'Science Fiction', 'Reissue', 296),
('9780345391803', 'The Hitchhiker\'s Guide to the Galaxy', 'Douglas Adams', 'Del Rey', 1995, 'Science Fiction', 'Reprint', 224),
('9780307387899', 'The Da Vinci Code', 'Dan Brown', 'Anchor', 2009, 'Mystery', 'Reprint', 597),
('9780553803709', 'A Game of Thrones', 'George R.R. Martin', 'Bantam', 2011, 'Fantasy', 'Reprint', 835),

-- Non-Fiction (Zone B)
('9781501124020', 'The Wright Brothers', 'David McCullough', 'Simon & Schuster', 2015, 'Biography', '1st', 336),
('9781501173219', 'Leonardo da Vinci', 'Walter Isaacson', 'Simon & Schuster', 2017, 'Biography', '1st', 624),
('9780307387622', 'Sapiens', 'Yuval Noah Harari', 'Harper Perennial', 2015, 'History', 'Reprint', 464),
('9780385537858', 'Guns, Germs, and Steel', 'Jared Diamond', 'W. W. Norton', 2017, 'History', 'Reissue', 528),
('9780385490818', 'A Brief History of Time', 'Stephen Hawking', 'Bantam', 1998, 'Science', 'Updated', 212),
('9780062316097', 'Sapiens: A Brief History of Humankind', 'Yuval Noah Harari', 'Harper', 2015, 'History', '1st', 443),

-- Academic/Technical (Zone C)
('9780262033848', 'Introduction to Algorithms', 'Thomas H. Cormen', 'MIT Press', 2009, 'Computer Science', '3rd', 1312),
('9780132350884', 'Clean Code', 'Robert C. Martin', 'Prentice Hall', 2008, 'Computer Science', '1st', 464),
('9780201616224', 'The Pragmatic Programmer', 'Andrew Hunt', 'Addison-Wesley', 1999, 'Computer Science', '1st', 352),
('9780134685991', 'Effective Java', 'Joshua Bloch', 'Addison-Wesley', 2017, 'Computer Science', '3rd', 416),
('9781449355739', 'Designing Data-Intensive Applications', 'Martin Kleppmann', 'O\'Reilly Media', 2017, 'Computer Science', '1st', 616),
('9780262510875', 'Structure and Interpretation of Computer Programs', 'Harold Abelson', 'MIT Press', 1996, 'Computer Science', '2nd', 657),
('9780134494166', 'Clean Architecture', 'Robert C. Martin', 'Prentice Hall', 2017, 'Computer Science', '1st', 432),
('9781491950296', 'Machine Learning Yearning', 'Andrew Ng', 'deeplearning.ai', 2018, 'Computer Science', '1st', 118),
('9780321573513', 'Algorithms', 'Robert Sedgewick', 'Addison-Wesley', 2011, 'Computer Science', '4th', 976);

-- ============================================================================
-- RFID TAGS
-- ============================================================================
INSERT INTO rfid_tags (tag_id, book_id) VALUES
-- Fiction
('RFID-000001', 1),
('RFID-000002', 2),
('RFID-000003', 3),
('RFID-000004', 4),
('RFID-000005', 5),
('RFID-000006', 6),
('RFID-000007', 7),
('RFID-000008', 8),
('RFID-000009', 9),
('RFID-000010', 10),

-- Non-Fiction
('RFID-000011', 11),
('RFID-000012', 12),
('RFID-000013', 13),
('RFID-000014', 14),
('RFID-000015', 15),
('RFID-000016', 16),

-- Academic
('RFID-000017', 17),
('RFID-000018', 18),
('RFID-000019', 19),
('RFID-000020', 20),
('RFID-000021', 21),
('RFID-000022', 22),
('RFID-000023', 23),
('RFID-000024', 24),
('RFID-000025', 25);

-- ============================================================================
-- BOOK LOCATION HISTORY (Initial placement)
-- ============================================================================
INSERT INTO book_location_history (book_id, shelf_id, reader_id, scanned_by, scan_method, timestamp) VALUES
-- Fiction books (Zone A)
(1, 1, NULL, 2, 'manual', '2026-02-01 09:00:00'),
(2, 1, NULL, 2, 'manual', '2026-02-01 09:05:00'),
(3, 2, NULL, 2, 'manual', '2026-02-01 09:10:00'),
(4, 2, NULL, 2, 'manual', '2026-02-01 09:15:00'),
(5, 4, NULL, 2, 'manual', '2026-02-01 09:20:00'),
(6, 4, NULL, 2, 'manual', '2026-02-01 09:25:00'),
(7, 3, NULL, 2, 'manual', '2026-02-01 09:30:00'),
(8, 3, NULL, 2, 'manual', '2026-02-01 09:35:00'),
(9, 5, NULL, 2, 'manual', '2026-02-01 09:40:00'),
(10, 4, NULL, 2, 'manual', '2026-02-01 09:45:00'),

-- Non-Fiction books (Zone B)
(11, 7, NULL, 2, 'manual', '2026-02-01 10:00:00'),
(12, 7, NULL, 2, 'manual', '2026-02-01 10:05:00'),
(13, 6, NULL, 2, 'manual', '2026-02-01 10:10:00'),
(14, 6, NULL, 2, 'manual', '2026-02-01 10:15:00'),
(15, 8, NULL, 2, 'manual', '2026-02-01 10:20:00'),
(16, 6, NULL, 2, 'manual', '2026-02-01 10:25:00'),

-- Academic books (Zone C)
(17, 11, NULL, 2, 'manual', '2026-02-01 11:00:00'),
(18, 11, NULL, 2, 'manual', '2026-02-01 11:05:00'),
(19, 11, NULL, 2, 'manual', '2026-02-01 11:10:00'),
(20, 11, NULL, 2, 'manual', '2026-02-01 11:15:00'),
(21, 11, NULL, 2, 'manual', '2026-02-01 11:20:00'),
(22, 11, NULL, 2, 'manual', '2026-02-01 11:25:00'),
(23, 11, NULL, 2, 'manual', '2026-02-01 11:30:00'),
(24, 11, NULL, 2, 'manual', '2026-02-01 11:35:00'),
(25, 11, NULL, 2, 'manual', '2026-02-01 11:40:00');

-- ============================================================================
-- ENTRY LOGS (Sample student entries)
-- ============================================================================
INSERT INTO entry_logs (
    user_id, entry_type, latitude, longitude, wifi_ssid, speed_kmh,
    confidence_score, gps_confidence, wifi_confidence, motion_confidence,
    auto_logged, manual_confirmed
) VALUES
-- Student 1 - High confidence entry
(4, 'entry', 37.77490, -122.41940, 'LibraryWiFi', 2.5, 100, 40, 40, 20, TRUE, FALSE),
-- Student 2 - Medium confidence, manually confirmed
(5, 'entry', 37.77485, -122.41935, 'LibraryWiFi', 4.0, 80, 40, 40, 0, TRUE, FALSE),
-- Student 3 - High confidence entry
(6, 'entry', 37.77492, -122.41942, 'LibraryWiFi', 1.8, 100, 40, 40, 20, TRUE, FALSE),
-- Student 1 - Exit
(4, 'exit', 37.77488, -122.41938, 'LibraryWiFi', 3.2, 80, 40, 40, 0, TRUE, FALSE);

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Uncomment to verify data insertion:

-- SELECT COUNT(*) AS total_users FROM users;
-- SELECT COUNT(*) AS total_books FROM books;
-- SELECT COUNT(*) AS total_shelves FROM shelves;
-- SELECT COUNT(*) AS total_readers FROM readers;
-- SELECT COUNT(*) AS total_beacons FROM beacons;
-- SELECT COUNT(*) AS total_rfid_tags FROM rfid_tags;
-- SELECT COUNT(*) AS total_location_history FROM book_location_history;
-- SELECT * FROM current_book_locations;

-- ============================================================================
-- END OF SEED DATA
-- ============================================================================
