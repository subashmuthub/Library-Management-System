/**
 * Add Mock Data to All Tables
 * Populates the database with sample data for testing and development
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'smart_library',
    port: process.env.DB_PORT || 3306
};

function toSqlDateTime(date) {
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

async function addMockData() {
    const connection = await mysql.createConnection(dbConfig);
    
    console.log('🎭 Adding Mock Data to Database...\n');

    try {
        // Get existing data counts
        const [bookCount] = await connection.query('SELECT COUNT(*) as count FROM books');
        const [userCount] = await connection.query('SELECT COUNT(*) as count FROM users');
        
        console.log(`📚 Books: ${bookCount[0].count}`);
        console.log(`👥 Users: ${userCount[0].count}\n`);

        // 1. Add Shelves
        console.log('📚 Adding Shelves...');
        await connection.query(`
            INSERT INTO shelves (shelf_code, zone, floor, section, description, capacity)
            VALUES 
                ('CS101', 'A', 1, 'Computer Science', 'Ground floor - CSE section', 50),
                ('CS102', 'A', 1, 'Programming', 'Ground floor - Programming books', 50),
                ('EC201', 'B', 2, 'Electronics', 'First floor - ECE section', 50),
                ('EE202', 'B', 2, 'Electrical', 'First floor - EEE section', 50),
                ('ME301', 'C', 3, 'Mechanical', 'Second floor - MECH section', 50),
                ('FI401', 'D', 4, 'Fiction', 'Third floor - Fiction section', 60),
                ('SC402', 'D', 4, 'Science', 'Third floor - Science section', 60)
            ON DUPLICATE KEY UPDATE shelf_code=VALUES(shelf_code)
        `);
        console.log('✅ Shelves added\n');

        // 2. Update books with shelf assignments
        console.log('📖 Assigning books to shelves...');
        await connection.query(`
            UPDATE books SET shelf_id = 1 WHERE category IN ('CSE', 'Computer Science', 'Computer Architecture') AND shelf_id IS NULL
        `);
        await connection.query(`
            UPDATE books SET shelf_id = 2 WHERE category = 'Programming' AND shelf_id IS NULL
        `);
        await connection.query(`
            UPDATE books SET shelf_id = 3 WHERE category = 'ECE' AND shelf_id IS NULL
        `);
        await connection.query(`
            UPDATE books SET shelf_id = 4 WHERE category = 'EEE' AND shelf_id IS NULL
        `);
        await connection.query(`
            UPDATE books SET shelf_id = 5 WHERE category = 'MECH' AND shelf_id IS NULL
        `);
        await connection.query(`
            UPDATE books SET shelf_id = 6 WHERE category IN ('Fiction', 'Fantasy', 'Mystery') AND shelf_id IS NULL
        `);
        await connection.query(`
            UPDATE books SET shelf_id = 7 WHERE category IN ('Science', 'Science Fiction', 'Technology') AND shelf_id IS NULL
        `);
        console.log('✅ Books assigned to shelves\n');

        // 3. Add RFID Readers
        console.log('📡 Adding RFID Readers...');
        const [shelfForReader] = await connection.query('SELECT id FROM shelves LIMIT 1');
        const shelfId = shelfForReader[0]?.id || 1;
        
        await connection.query(`
            INSERT INTO readers (reader_code, reader_type, shelf_id, is_active, last_seen)
            VALUES 
                ('READER-001', 'fixed', ?, 1, NOW()),
                ('READER-002', 'fixed', ?, 1, NOW()),
                ('READER-003', 'fixed', ?, 1, NOW()),
                ('READER-004', 'handheld', NULL, 1, NOW()),
                ('READER-005', 'handheld', NULL, 0, DATE_SUB(NOW(), INTERVAL 2 HOUR))
            ON DUPLICATE KEY UPDATE reader_code=VALUES(reader_code)
        `, [shelfId, shelfId, shelfId]);
        console.log('✅ RFID Readers added\n');

        // 4. Add Beacons
        console.log('📍 Adding Beacons...');
        await connection.query(`
            INSERT INTO beacons (beacon_uuid, major, minor, zone, location_description, is_active, battery_level, last_seen)
            VALUES 
                ('f7826da6-4fa2-4e98-8024-bc5b71e0893e', 100, 1, 'A', 'Main Entrance', 1, 85, NOW()),
                ('f7826da6-4fa2-4e98-8024-bc5b71e0893f', 100, 2, 'A', 'Exit Gate', 1, 90, NOW()),
                ('f7826da6-4fa2-4e98-8024-bc5b71e08940', 101, 1, 'B', 'First Floor Center', 1, 78, NOW()),
                ('f7826da6-4fa2-4e98-8024-bc5b71e08941', 102, 1, 'C', 'Second Floor Center', 1, 82, NOW()),
                ('f7826da6-4fa2-4e98-8024-bc5b71e08942', 100, 3, 'A', 'Near CSE Shelves', 1, 75, NOW())
            ON DUPLICATE KEY UPDATE beacon_uuid=VALUES(beacon_uuid)
        `);
        console.log('✅ Beacons added\n');

        // 5. Add RFID Tags for some books
        console.log('🏷️ Adding RFID Tags...');
        const [books] = await connection.query('SELECT id FROM books LIMIT 20');
        for (let i = 0; i < books.length; i++) {
            const tagId = `TAG-BOOK-${String(books[i].id).padStart(5, '0')}`;
            await connection.query(`
                INSERT INTO rfid_tags (tag_id, book_id, is_active)
                VALUES (?, ?, 1)
                ON DUPLICATE KEY UPDATE tag_id=VALUES(tag_id)
            `, [tagId, books[i].id]);
        }
        console.log(`✅ ${books.length} RFID Tags added\n`);

        // 6. Add Transactions
        console.log('📤 Adding Book Transactions...');
        const [users] = await connection.query('SELECT id FROM users WHERE role_id = 3 LIMIT 5');
        const [librarians] = await connection.query('SELECT id FROM users WHERE role_id = 2 LIMIT 1');
        const librarianId = librarians[0]?.id || users[0]?.id;
        const [availableBooks] = await connection.query('SELECT id FROM books LIMIT 30');

        if (availableBooks.length === 0) {
            console.log('⚠️ No books available for transactions. Skipping...\n');
        } else {
            // Active checkouts
            for (let i = 0; i < Math.min(users.length, availableBooks.length, 10); i++) {
                const bookId = availableBooks[i].id;
                await connection.query(`
                    INSERT INTO book_transactions 
                    (book_id, user_id, checkout_date, due_date, checked_out_by, status)
                    VALUES (?, ?, DATE_SUB(NOW(), INTERVAL ? DAY), DATE_ADD(NOW(), INTERVAL ? DAY), ?, 'active')
                    ON DUPLICATE KEY UPDATE book_id=VALUES(book_id)
                `, [bookId, users[i % users.length].id, i + 1, 14 - i, librarianId]);
            }

            // Overdue checkouts
            for (let i = 0; i < Math.min(users.length, Math.min(availableBooks.length - 10, 5)); i++) {
                const bookId = availableBooks[i + 10].id;
                await connection.query(`
                    INSERT INTO book_transactions 
                    (book_id, user_id, checkout_date, due_date, checked_out_by, status)
                    VALUES (?, ?, DATE_SUB(NOW(), INTERVAL ? DAY), DATE_SUB(NOW(), INTERVAL ? DAY), ?, 'active')
                    ON DUPLICATE KEY UPDATE book_id=VALUES(book_id)
                `, [bookId, users[i % users.length].id, 20 + i, 5 + i, librarianId]);
            }

            // Returned books
            for (let i = 0; i < Math.min(users.length, Math.min(availableBooks.length - 15, 8)); i++) {
                const bookId = availableBooks[i + 15].id;
                await connection.query(`
                    INSERT INTO book_transactions 
                    (book_id, user_id, checkout_date, due_date, return_date, checked_out_by, returned_by, status)
                    VALUES (?, ?, DATE_SUB(NOW(), INTERVAL ? DAY), DATE_SUB(NOW(), INTERVAL ? DAY), DATE_SUB(NOW(), INTERVAL ? DAY), ?, ?, 'returned')
                    ON DUPLICATE KEY UPDATE book_id=VALUES(book_id)
                `, [bookId, users[i % users.length].id, 30 + i, 16 + i, 5 + i, librarianId, librarianId]);
            }
            console.log('✅ Book Transactions added\n');
        }

        // 6b. Add structured activity transactions (fresh each run)
        console.log('📈 Adding structured checkout patterns...');
        await connection.query(`DELETE FROM book_transactions WHERE notes LIKE '[MOCK_ACTIVITY]%'`);

        const [allStudents] = await connection.query('SELECT id FROM users WHERE role_id = 3 AND status = "active" ORDER BY id LIMIT 6');
        const [chartBooks] = await connection.query('SELECT id FROM books ORDER BY id LIMIT 60');

        if (allStudents.length && chartBooks.length) {
            const activityProfiles = [
                { weeklyVisits: 6, borrowWeight: 1.0, keepActive: 2 },
                { weeklyVisits: 5, borrowWeight: 0.85, keepActive: 2 },
                { weeklyVisits: 4, borrowWeight: 0.7, keepActive: 1 },
                { weeklyVisits: 3, borrowWeight: 0.55, keepActive: 1 },
                { weeklyVisits: 2, borrowWeight: 0.35, keepActive: 0 },
                { weeklyVisits: 1, borrowWeight: 0.2, keepActive: 0 }
            ];

            let bookCursor = 0;
            const today = new Date();
            const horizonDays = 45;

            for (let s = 0; s < allStudents.length; s++) {
                const studentId = allStudents[s].id;
                const profile = activityProfiles[Math.min(s, activityProfiles.length - 1)];
                let activeIssued = 0;

                for (let dayOffset = horizonDays; dayOffset >= 1; dayOffset--) {
                    const dayDate = new Date(today);
                    dayDate.setDate(today.getDate() - dayOffset);
                    const weekday = dayDate.getDay();
                    const isVisitDay = weekday <= profile.weeklyVisits;
                    const highDemandWindow = dayOffset <= 20;
                    const shouldBorrow = isVisitDay && ((dayOffset + s) % 3 === 0 || highDemandWindow) && Math.random() < profile.borrowWeight;

                    if (!shouldBorrow) continue;

                    const bookId = chartBooks[bookCursor % chartBooks.length].id;
                    bookCursor += 1;

                    const checkoutDate = new Date(dayDate);
                    checkoutDate.setHours(10 + ((s + dayOffset) % 5), 15, 0, 0);

                    const dueDate = new Date(checkoutDate);
                    dueDate.setDate(checkoutDate.getDate() + 14);

                    const keepOpen = activeIssued < profile.keepActive && dayOffset <= 12;
                    const markOverdue = keepOpen && dayOffset >= 9;

                    let returnDate = null;
                    let status = 'returned';

                    if (keepOpen) {
                        status = markOverdue ? 'active' : 'active';
                        activeIssued += 1;
                    } else {
                        returnDate = new Date(dueDate);
                        returnDate.setDate(dueDate.getDate() - (1 + ((dayOffset + s) % 5)));
                        if (returnDate > today) {
                            returnDate = new Date(today);
                        }
                    }

                    await connection.query(`
                        INSERT INTO book_transactions
                        (book_id, user_id, checkout_date, due_date, return_date, status, checked_out_by, returned_by, renewal_count, notes)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        bookId,
                        studentId,
                        toSqlDateTime(checkoutDate).slice(0, 10),
                        toSqlDateTime(dueDate).slice(0, 10),
                        returnDate ? toSqlDateTime(returnDate).slice(0, 10) : null,
                        status,
                        librarianId,
                        returnDate ? librarianId : null,
                        dayOffset % 9 === 0 ? 1 : 0,
                        '[MOCK_ACTIVITY] Structured checkout pattern'
                    ]);
                }
            }

            console.log('✅ Structured checkout patterns added\n');
        } else {
            console.log('⚠️ Unable to add structured checkout patterns (missing students/books)\n');
        }

        // 7. Add Fines (for overdue books)
        console.log('💰 Adding Fines...');
        const [overdueTransactions] = await connection.query(`
            SELECT id, user_id, DATEDIFF(NOW(), due_date) as days_overdue
            FROM book_transactions 
            WHERE status = 'active' AND due_date < NOW()
        `);
        
        for (const trans of overdueTransactions) {
            const fineAmount = trans.days_overdue * 5; // ₹5 per day
            await connection.query(`
                INSERT INTO fines 
                (transaction_id, user_id, amount, days_overdue, fine_rate, fine_type, status, notes)
                VALUES (?, ?, ?, ?, 5.00, 'overdue', 'pending', 'Overdue book fine')
                ON DUPLICATE KEY UPDATE amount=VALUES(amount)
            `, [trans.id, trans.user_id, fineAmount, trans.days_overdue]);
        }
        console.log(`✅ ${overdueTransactions.length} Fines added\n`);

        // 8. Add some paid fines
        console.log('💳 Adding Paid Fines...');
        const [returnedTrans] = await connection.query(`
            SELECT id, user_id FROM book_transactions WHERE status = 'returned' LIMIT 3
        `);
        for (const trans of returnedTrans) {
            await connection.query(`
                INSERT INTO fines 
                (transaction_id, user_id, amount, days_overdue, fine_rate, fine_type, status, amount_paid, payment_date, payment_method, notes, processed_by)
                VALUES (?, ?, 75.00, 15, 5.00, 'overdue', 'paid', 75.00, DATE_SUB(NOW(), INTERVAL 3 DAY), 'cash', 'Overdue book fine - paid', ?)
                ON DUPLICATE KEY UPDATE status=VALUES(status)
            `, [trans.id, trans.user_id, librarianId]);
        }
        console.log('✅ Paid Fines added\n');

        // 9. Add Reservations
        console.log('📝 Adding Book Reservations...');
        const [booksForReservation] = await connection.query('SELECT id FROM books LIMIT 10');
        for (let i = 0; i < Math.min(users.length, booksForReservation.length, 6); i++) {
            const bookId = booksForReservation[i].id;
            const status = i < 2 ? 'ready' : i < 4 ? 'active' : 'expired';
            await connection.query(`
                INSERT INTO reservations 
                (book_id, user_id, status, queue_position, expiry_date, scheduled_date, created_at)
                VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL ? DAY), DATE_SUB(NOW(), INTERVAL ? DAY))
                ON DUPLICATE KEY UPDATE book_id=VALUES(book_id)
            `, [bookId, users[i % users.length].id, status, i + 1, i + 1, i + 1]);
        }
        console.log('✅ Book Reservations added\n');

        // 10. Add Entry Logs
        console.log('🚪 Adding Entry Logs...');
        const libraryLat = 11.0168;
        const libraryLng = 76.9558;

        await connection.query(`DELETE FROM entry_logs WHERE wifi_ssid = 'MockLibraryPattern'`);

        const [activityStudents] = await connection.query('SELECT id FROM users WHERE role_id = 3 AND status = "active" ORDER BY id LIMIT 6');
        const visitProfiles = [6, 5, 4, 3, 2, 1];
        const lookbackDays = 30;

        for (let s = 0; s < activityStudents.length; s++) {
            const userId = activityStudents[s].id;
            const weeklyVisits = visitProfiles[Math.min(s, visitProfiles.length - 1)];

            for (let dayOffset = lookbackDays; dayOffset >= 0; dayOffset--) {
                const day = new Date();
                day.setDate(day.getDate() - dayOffset);
                const weekday = day.getDay();
                const baseVisits = weekday <= weeklyVisits ? 1 : 0;
                const burstVisit = weeklyVisits >= 5 && weekday === 2 ? 1 : 0;
                const visitsToday = baseVisits + burstVisit;

                for (let v = 0; v < visitsToday; v++) {
                    const entryTime = new Date(day);
                    entryTime.setHours(8 + ((s + v) % 5), 20 + ((dayOffset + s) % 30), 0, 0);

                    const exitTime = new Date(entryTime);
                    exitTime.setHours(entryTime.getHours() + 2 + (v % 2));

                    await connection.query(`
                        INSERT INTO entry_logs
                        (user_id, entry_type, latitude, longitude, wifi_ssid, speed_kmh, confidence_score, gps_confidence, wifi_confidence, motion_confidence, auto_logged, manual_confirmed, timestamp)
                        VALUES (?, 'entry', ?, ?, 'MockLibraryPattern', ?, 95, 35, 40, 20, 1, 0, ?)
                    `, [
                        userId,
                        libraryLat + ((s * 0.00008) + (v * 0.00002)),
                        libraryLng + ((s * 0.00006) + (v * 0.00003)),
                        (1.2 + ((s + v) % 3)).toFixed(2),
                        toSqlDateTime(entryTime)
                    ]);

                    await connection.query(`
                        INSERT INTO entry_logs
                        (user_id, entry_type, latitude, longitude, wifi_ssid, speed_kmh, confidence_score, gps_confidence, wifi_confidence, motion_confidence, auto_logged, manual_confirmed, timestamp)
                        VALUES (?, 'exit', ?, ?, 'MockLibraryPattern', ?, 93, 34, 39, 20, 1, 0, ?)
                    `, [
                        userId,
                        libraryLat + ((s * 0.00007) + (v * 0.00002)),
                        libraryLng + ((s * 0.00005) + (v * 0.00002)),
                        (1.1 + ((s + v + 1) % 3)).toFixed(2),
                        toSqlDateTime(exitTime)
                    ]);
                }
            }
        }

        console.log('✅ Entry Logs added with structured daily patterns\n');

        // Get final counts
        console.log('\n📊 Final Database Summary:');
        const tables = [
            'books', 'users', 'shelves', 'readers', 'beacons', 
            'rfid_tags', 'book_transactions', 'fines', 'reservations', 'entry_logs'
        ];
        
        for (const table of tables) {
            const [count] = await connection.query(`SELECT COUNT(*) as count FROM ${table}`);
            console.log(`   ${table.padEnd(25)}: ${count[0].count}`);
        }

        console.log('\n✅ Mock data successfully added to all tables!');
        console.log('\n🚀 You can now test all pages with sample data.');
        console.log('   Backend: http://localhost:3001');
        console.log('   Frontend: http://localhost:5173');

    } catch (error) {
        console.error('❌ Error adding mock data:', error.message);
        throw error;
    } finally {
        await connection.end();
    }
}

addMockData().catch(console.error);
