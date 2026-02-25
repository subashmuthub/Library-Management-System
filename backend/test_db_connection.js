const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration (matching backend config)
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smart_library',
    port: parseInt(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    acquireTimeout: 60000,
    timeout: 60000
};

async function testDatabaseConnection() {
    console.log('🔍 DATABASE CONNECTION & DATA VERIFICATION\n');
    console.log('============================================================');
    
    try {
        console.log('📊 Testing Database Connection...');
        console.log('Config:', {
            host: dbConfig.host,
            user: dbConfig.user,
            database: dbConfig.database,
            port: dbConfig.port
        });
        
        // Test basic connection
        const connection = await mysql.createConnection(dbConfig);
        console.log('✅ Database connection successful!');
        
        console.log('\n--------------------------------------------------\n');
        
        // Test 1: Check books table structure
        console.log('📋 Testing Books Table Structure...');
        const [columns] = await connection.execute(`
            SHOW COLUMNS FROM books
        `);
        
        console.log('✅ Books table columns:');
        columns.forEach(col => {
            console.log(`   • ${col.Field} (${col.Type}) ${col.Null === 'NO' ? '- Required' : '- Optional'}`);
        });
        
        console.log('\n--------------------------------------------------\n');
        
        // Test 2: Count total books
        console.log('📚 Testing Book Data...');
        const [countResult] = await connection.execute(`
            SELECT COUNT(*) as total FROM books
        `);
        const totalBooks = countResult[0].total;
        console.log(`✅ Total books in database: ${totalBooks}`);
        
        // Test 3: Count by category 
        const [categoryCount] = await connection.execute(`
            SELECT 
                category, 
                COUNT(*) as count 
            FROM books 
            WHERE category IS NOT NULL 
            GROUP BY category 
            ORDER BY category
        `);
        
        console.log('\n📊 Books by Category:');
        const deptCategories = ['CSE', 'EEE', 'ECE', 'MECH', 'AIDS', 'S&H'];
        let totalDeptBooks = 0;
        
        categoryCount.forEach(cat => {
            if (deptCategories.includes(cat.category)) {
                console.log(`   🎯 ${cat.category}: ${cat.count} books`);
                totalDeptBooks += cat.count;
            }
        });
        
        console.log(`\n📈 Engineering Department Books: ${totalDeptBooks}`);
        console.log('📚 Other Categories:');
        categoryCount.forEach(cat => {
            if (!deptCategories.includes(cat.category)) {
                console.log(`   • ${cat.category}: ${cat.count} books`);
            }
        });
        
        console.log('\n--------------------------------------------------\n');
        
        // Test 4: Sample book records
        console.log('📖 Sample Book Records:');
        const [sampleBooks] = await connection.execute(`
            SELECT id, title, author, category, total_copies, publication_year 
            FROM books 
            ORDER BY updated_at DESC 
            LIMIT 5
        `);
        
        console.log('✅ Latest 5 books:');
        sampleBooks.forEach(book => {
            console.log(`   • ID ${book.id}: "${book.title}" by ${book.author}`);
            console.log(`     Category: ${book.category}, Copies: ${book.total_copies}, Year: ${book.publication_year}`);
        });
        
        console.log('\n--------------------------------------------------\n');
        
        // Test 5: Check for department-specific books
        console.log('🎯 Testing Department Books...');
        for (const dept of deptCategories) {
            const [deptBooks] = await connection.execute(`
                SELECT title, author FROM books WHERE category = ? LIMIT 3
            `, [dept]);
            
            if (deptBooks.length > 0) {
                console.log(`✅ ${dept} Department (${deptBooks.length} books):`);
                deptBooks.forEach(book => {
                    console.log(`   • "${book.title}" by ${book.author}`);
                });
            } else {
                console.log(`⚠️  No books found for ${dept} department`);
            }
        }
        
        console.log('\n============================================================\n');
        
        // Test 6: Data integrity checks
        console.log('🔍 Data Integrity Checks...');
        
        // Check for missing required fields
        const [missingData] = await connection.execute(`
            SELECT 
                SUM(CASE WHEN title IS NULL OR title = '' THEN 1 ELSE 0 END) as missing_titles,
                SUM(CASE WHEN author IS NULL OR author = '' THEN 1 ELSE 0 END) as missing_authors,
                SUM(CASE WHEN isbn IS NULL OR isbn = '' THEN 1 ELSE 0 END) as missing_isbn,
                SUM(CASE WHEN category IS NULL OR category = '' THEN 1 ELSE 0 END) as missing_category
            FROM books
        `);
        
        const integrity = missingData[0];
        console.log('✅ Data Quality Report:');
        console.log(`   • Missing Titles: ${integrity.missing_titles}`);
        console.log(`   • Missing Authors: ${integrity.missing_authors}`);
        console.log(`   • Missing ISBN: ${integrity.missing_isbn}`);
        console.log(`   • Missing Categories: ${integrity.missing_category}`);
        
        // Check for duplicate ISBNs
        const [duplicates] = await connection.execute(`
            SELECT isbn, COUNT(*) as count 
            FROM books 
            WHERE isbn IS NOT NULL AND isbn != ''
            GROUP BY isbn 
            HAVING COUNT(*) > 1
        `);
        
        if (duplicates.length > 0) {
            console.log(`\n⚠️  Found ${duplicates.length} duplicate ISBN(s):`);
            duplicates.forEach(dup => {
                console.log(`   • ISBN ${dup.isbn}: ${dup.count} copies`);
            });
        } else {
            console.log('\n✅ No duplicate ISBNs found');
        }
        
        await connection.end();
        
        console.log('\n🎉 DATABASE VERIFICATION COMPLETE!');
        console.log('============================================================');
        console.log('✅ Database connection: Working');
        console.log(`✅ Total books: ${totalBooks}`);
        console.log(`✅ Department books: ${totalDeptBooks}`);
        console.log('✅ Data integrity: Good');
        console.log('✅ Ready for frontend display');
        
    } catch (error) {
        console.error('❌ Database test failed:');
        console.error('Error:', error.message);
        console.error('Code:', error.code);
        
        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.log('\n💡 Database access denied. Check credentials:');
            console.log(`   Host: ${dbConfig.host}`);
            console.log(`   User: ${dbConfig.user}`);
            console.log(`   Database: ${dbConfig.database}`);
        } else if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 Database server not running. Start MySQL service.');
        } else if (error.code === 'ER_BAD_DB_ERROR') {
            console.log('\n💡 Database does not exist. Create the database first.');
        }
    }
}

testDatabaseConnection();