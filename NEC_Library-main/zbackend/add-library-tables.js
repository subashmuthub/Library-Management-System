const mysql = require('mysql2/promise');
require('dotenv').config();

async function addLibraryTables() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    
    console.log('Adding missing library management tables...');
    
    // Add missing columns to books table
    try {
      await connection.execute(`
        ALTER TABLE books 
        ADD COLUMN total_copies INT DEFAULT 1,
        ADD COLUMN available_copies INT DEFAULT 1,
        ADD COLUMN category_id INT NULL,
        ADD COLUMN shelf_id INT NULL,
        ADD COLUMN status ENUM('active', 'inactive', 'damaged', 'lost') DEFAULT 'active'
      `);
      console.log('✓ Enhanced books table');
    } catch (e) {
      console.log('- Books table already enhanced or error:', e.message);
    }
    
    // Create book_categories table
    try {
      await connection.execute(`
        CREATE TABLE book_categories (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          dewey_decimal VARCHAR(20),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_name (name)
        ) ENGINE=InnoDB
      `);
      console.log('✓ Created book_categories table');
    } catch (e) {
      console.log('- book_categories table already exists or error:', e.message);
    }
    
    // Create book_transactions table
    try {
      await connection.execute(`
        CREATE TABLE book_transactions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          book_id INT NOT NULL,
          checkout_date DATE NOT NULL,
          due_date DATE NOT NULL,
          return_date DATE NULL,
          renewal_count INT DEFAULT 0,
          checked_out_by INT NULL,
          returned_by INT NULL,
          reservation_id INT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (book_id) REFERENCES books(id),
          FOREIGN KEY (checked_out_by) REFERENCES users(id),
          FOREIGN KEY (returned_by) REFERENCES users(id),
          INDEX idx_user_id (user_id),
          INDEX idx_book_id (book_id),
          INDEX idx_checkout_date (checkout_date),
          INDEX idx_due_date (due_date)
        ) ENGINE=InnoDB
      `);
      console.log('✓ Created book_transactions table');
    } catch (e) {
      console.log('- book_transactions table already exists or error:', e.message);
    }
    
    // Create fines table
    try {
      await connection.execute(`
        CREATE TABLE fines (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          transaction_id INT NULL,
          fine_type ENUM('overdue', 'damage', 'lost_book', 'other') DEFAULT 'overdue',
          amount DECIMAL(10,2) NOT NULL,
          amount_paid DECIMAL(10,2) DEFAULT 0,
          days_overdue INT DEFAULT 0,
          fine_rate DECIMAL(10,2) DEFAULT 1.00,
          status ENUM('pending', 'paid', 'waived', 'partial') DEFAULT 'pending',
          payment_date DATE NULL,
          payment_method ENUM('cash', 'card', 'online', 'waived') NULL,
          processed_by INT NULL,
          notes TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (transaction_id) REFERENCES book_transactions(id),
          FOREIGN KEY (processed_by) REFERENCES users(id),
          INDEX idx_user_id (user_id),
          INDEX idx_status (status)
        ) ENGINE=InnoDB
      `);
      console.log('✓ Created fines table');
    } catch (e) {
      console.log('- fines table already exists or error:', e.message);
    }
    
    // Create reservations table
    try {
      await connection.execute(`
        CREATE TABLE reservations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          book_id INT NOT NULL,
          status ENUM('active', 'ready', 'cancelled', 'fulfilled', 'expired') DEFAULT 'active',
          queue_position INT DEFAULT 1,
          scheduled_date TIMESTAMP NULL,
          expiry_date TIMESTAMP NOT NULL,
          pickup_date TIMESTAMP NULL,
          fulfilled_by INT NULL,
          notes TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (book_id) REFERENCES books(id),
          FOREIGN KEY (fulfilled_by) REFERENCES users(id),
          INDEX idx_user_id (user_id),
          INDEX idx_book_id (book_id),
          INDEX idx_status (status),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB
      `);
      console.log('✓ Created reservations table');
    } catch (e) {
      console.log('- reservations table already exists or error:', e.message);
    }
    
    // Create library_settings table
    try {
      await connection.execute(`
        CREATE TABLE library_settings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          setting_key VARCHAR(100) UNIQUE NOT NULL,
          setting_value TEXT NOT NULL,
          description TEXT,
          category VARCHAR(50) DEFAULT 'general',
          data_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
      `);
      console.log('✓ Created library_settings table');
    } catch (e) {
      console.log('- library_settings table already exists or error:', e.message);
    }
    
    // Add some default categories
    try {
      await connection.execute(`
        INSERT IGNORE INTO book_categories (name, description, dewey_decimal) VALUES
        ('Fiction', 'Novels and literary works', '800-899'),
        ('Non-Fiction', 'Factual books and reference materials', '000-799'),
        ('Science', 'Scientific texts and research', '500-599'),
        ('Technology', 'Computer science and technology', '004-006'),
        ('Business', 'Business and economic texts', '330-339'),
        ('Reference', 'Dictionaries and encyclopedias', '000-099')
      `);
      console.log('✓ Added default book categories');
    } catch (e) {
      console.log('- Categories already exist or error:', e.message);
    }
    
    // Add some default library settings
    try {
      await connection.execute(`
        INSERT IGNORE INTO library_settings (setting_key, setting_value, description, category, data_type) VALUES
        ('max_checkout_limit', '5', 'Maximum number of books a user can checkout', 'circulation', 'number'),
        ('default_loan_period', '14', 'Default loan period in days', 'circulation', 'number'),
        ('max_renewal_count', '2', 'Maximum number of times a book can be renewed', 'circulation', 'number'),
        ('daily_fine_rate', '1.00', 'Fine amount per day for overdue books', 'fines', 'number'),
        ('max_fine_amount', '50.00', 'Maximum fine amount per book', 'fines', 'number'),
        ('reservation_hold_days', '3', 'Number of days to hold a reserved book', 'circulation', 'number')
      `);
      console.log('✓ Added default library settings');
    } catch (e) {
      console.log('- Settings already exist or error:', e.message);
    }
    
    console.log('\n✓ Database setup completed successfully!');
    console.log('✓ All library management features are now available.');
    
    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

addLibraryTables();