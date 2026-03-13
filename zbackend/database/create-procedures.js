/**
 * Create Stored Procedures Manually
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function createProcedures() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: 'smart_library'
    });

    console.log('✓ Connected to MySQL');

    // Drop existing procedures
    console.log('\nDropping existing procedures...');
    await connection.query('DROP PROCEDURE IF EXISTS checkout_book');
    await connection.query('DROP PROCEDURE IF EXISTS return_book');
    await connection.query('DROP PROCEDURE IF EXISTS calculate_entry_confidence');

    // Create checkout_book procedure
    console.log('\nCreating checkout_book procedure...');
    await connection.query(`
      CREATE PROCEDURE checkout_book(
          IN p_user_id INT,
          IN p_book_id INT,
          IN p_issued_by INT,
          IN p_loan_days INT,
          OUT p_success BOOLEAN,
          OUT p_message VARCHAR(255)
      )
      BEGIN
          DECLARE v_is_available BOOLEAN DEFAULT FALSE;
          DECLARE v_user_checkout_count INT DEFAULT 0;
          DECLARE v_max_checkouts INT DEFAULT 5;
          DECLARE v_has_overdue BOOLEAN DEFAULT FALSE;
          
          DECLARE EXIT HANDLER FOR SQLEXCEPTION
          BEGIN
              ROLLBACK;
              SET p_success = FALSE;
              SET p_message = 'Database error occurred';
          END;
          
          START TRANSACTION;
          
          -- Check if book is available
          SELECT COUNT(*) = 0 INTO v_is_available
          FROM book_transactions 
          WHERE book_id = p_book_id AND status = 'active';
          
          IF NOT v_is_available THEN
              SET p_success = FALSE;
              SET p_message = 'Book is currently checked out';
              ROLLBACK;
          ELSE
              -- Check user's current checkout count
              SELECT COUNT(*) INTO v_user_checkout_count
              FROM book_transactions 
              WHERE user_id = p_user_id AND status = 'active';
              
              -- Check for overdue books
              SELECT COUNT(*) > 0 INTO v_has_overdue
              FROM book_transactions
              WHERE user_id = p_user_id AND status = 'active' AND due_date < CURDATE();
              
              IF v_user_checkout_count >= v_max_checkouts THEN
                  SET p_success = FALSE;
                  SET p_message = 'Maximum checkout limit reached';
                  ROLLBACK;
              ELSEIF v_has_overdue THEN
                  SET p_success = FALSE;
                  SET p_message = 'Cannot checkout: user has overdue books';
                  ROLLBACK;
              ELSE
                  -- Create checkout transaction
                  INSERT INTO book_transactions (
                      user_id, 
                      book_id, 
                      checked_out_by,
                      checkout_date,
                      due_date,
                      status
                  ) VALUES (
                      p_user_id,
                      p_book_id,
                      p_issued_by,
                      CURDATE(),
                      DATE_ADD(CURDATE(), INTERVAL p_loan_days DAY),
                      'active'
                  );
                  
                  SET p_success = TRUE;
                  SET p_message = 'Book checked out successfully';
                  COMMIT;
              END IF;
          END IF;
      END
    `);
    console.log('✓ checkout_book created');

    // Create return_book procedure
    console.log('\nCreating return_book procedure...');
    await connection.query(`
      CREATE PROCEDURE return_book(
          IN p_transaction_id INT,
          IN p_returned_by INT,
          IN p_condition VARCHAR(50),
          OUT p_success BOOLEAN,
          OUT p_message VARCHAR(255),
          OUT p_fine_amount DECIMAL(10,2)
      )
      BEGIN
          DECLARE v_due_date DATE;
          DECLARE v_return_date DATE DEFAULT CURDATE();
          DECLARE v_days_overdue INT DEFAULT 0;
          DECLARE v_fine_per_day DECIMAL(10,2) DEFAULT 1.00;
          DECLARE v_book_id INT;
          DECLARE v_user_id INT;
          
          DECLARE EXIT HANDLER FOR SQLEXCEPTION
          BEGIN
              ROLLBACK;
              SET p_success = FALSE;
              SET p_message = 'Database error occurred';
              SET p_fine_amount = 0;
          END;
          
          START TRANSACTION;
          
          -- Get transaction details
          SELECT due_date, book_id, user_id INTO v_due_date, v_book_id, v_user_id
          FROM book_transactions
          WHERE id = p_transaction_id AND status = 'active';
          
          IF v_due_date IS NULL THEN
              SET p_success = FALSE;
              SET p_message = 'Transaction not found or already returned';
              SET p_fine_amount = 0;
              ROLLBACK;
          ELSE
              -- Calculate fine if overdue
              SET v_days_overdue = GREATEST(0, DATEDIFF(v_return_date, v_due_date));
              SET p_fine_amount = v_days_overdue * v_fine_per_day;
              
              -- Update transaction
              UPDATE book_transactions
              SET 
                  return_date = v_return_date,
                  returned_by = p_returned_by,
                  return_condition = p_condition,
                  status = 'returned'
              WHERE id = p_transaction_id;
              
              -- Create fine record if overdue
              IF v_days_overdue > 0 THEN
                  INSERT INTO fines (
                      user_id,
                      transaction_id,
                      amount,
                      days_overdue,
                      status
                  ) VALUES (
                      v_user_id,
                      p_transaction_id,
                      p_fine_amount,
                      v_days_overdue,
                      'pending'
                  );
              END IF;
              
              SET p_success = TRUE;
              SET p_message = 'Book returned successfully';
              COMMIT;
          END IF;
      END
    `);
    console.log('✓ return_book created');

    // Create calculate_entry_confidence procedure
    console.log('\nCreating calculate_entry_confidence procedure...');
    await connection.query(`
      CREATE PROCEDURE calculate_entry_confidence(
          IN p_user_id INT,
          IN p_rfid_detected BOOLEAN,
          IN p_reader_id INT,
          IN p_signal_strength INT,
          IN p_gps_lat DECIMAL(10,7),
          IN p_gps_lng DECIMAL(10,7),
          IN p_wifi_detected BOOLEAN,
          IN p_motion_detected BOOLEAN,
          OUT p_confidence DECIMAL(5,2)
      )
      BEGIN
          DECLARE v_confidence_score DECIMAL(5,2) DEFAULT 0;
          DECLARE v_is_entry_zone BOOLEAN DEFAULT FALSE;
          DECLARE v_is_authorized BOOLEAN DEFAULT FALSE;
          
          -- Check if reader is in entry zone
          SELECT COUNT(*) > 0 INTO v_is_entry_zone
          FROM readers
          WHERE id = p_reader_id AND zone = 'entry';
          
          -- Check if user is active
          SELECT COUNT(*) > 0 INTO v_is_authorized
          FROM users
          WHERE id = p_user_id AND status = 'active';
          
          IF NOT v_is_authorized THEN
              SET p_confidence = 0;
          ELSE
              -- RFID detection (40%)
              IF p_rfid_detected THEN
                  IF p_signal_strength >= -40 THEN
                      SET v_confidence_score = v_confidence_score + 40;
                  ELSEIF p_signal_strength >= -60 THEN
                      SET v_confidence_score = v_confidence_score + 30;
                  ELSE
                      SET v_confidence_score = v_confidence_score + 20;
                  END IF;
              END IF;
              
              -- GPS proximity (30%)
              IF p_gps_lat IS NOT NULL AND p_gps_lng IS NOT NULL THEN
                  SET v_confidence_score = v_confidence_score + 30;
              END IF;
              
              -- WiFi detection (20%)
              IF p_wifi_detected THEN
                  SET v_confidence_score = v_confidence_score + 20;
              END IF;
              
              -- Motion detection (10%)
              IF p_motion_detected THEN
                  SET v_confidence_score = v_confidence_score + 10;
              END IF;
              
              -- Bonus for entry zone
              IF v_is_entry_zone THEN
                  SET v_confidence_score = v_confidence_score * 1.1;
              END IF;
              
              -- Cap at 100
              SET p_confidence = LEAST(100, v_confidence_score);
          END IF;
      END
    `);
    console.log('✓ calculate_entry_confidence created');

    // Verify
    console.log('\nVerifying procedures...');
    const [procs] = await connection.query(`
      SELECT ROUTINE_NAME 
      FROM information_schema.ROUTINES 
      WHERE ROUTINE_SCHEMA = 'smart_library' 
      AND ROUTINE_TYPE = 'PROCEDURE'
      ORDER BY ROUTINE_NAME
    `);
    
    console.log(`Found ${procs.length} procedures:`);
    procs.forEach(proc => console.log(`  ✓ ${proc.ROUTINE_NAME}`));

    await connection.end();
    console.log('\n✓ All procedures installed successfully!');

  } catch (error) {
    console.error('\n✗ Error:', error.message);
    process.exit(1);
  }
}

createProcedures();
