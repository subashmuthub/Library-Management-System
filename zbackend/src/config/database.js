/**
 * Database Configuration and Connection Pool
 *
 * Creates a MySQL connection pool for efficient database access.
 * Uses environment variables for configuration.
 */

const mysql = require("mysql2/promise");
const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

// Create connection pool
// WHY POOL: Connection pooling reuses connections instead of creating
// new ones for each query, significantly improving performance.
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number.parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "smart_library",
  waitForConnections: true,
  connectionLimit: 10, // Maximum 10 concurrent connections
  queueLimit: 0, // Unlimited queue
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

// Test database connection
const checkDatabaseConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log("✓ Database connected successfully");
    connection.release();
  } catch (err) {
    console.error("✗ Database connection failed:", err.message);
    process.exit(1);
  }
};

checkDatabaseConnection();

// Helper function to execute queries
const query = async (sql, params = []) => {
  try {
    const [results] = await pool.query(sql, params);
    return results;
  } catch (error) {
    console.error("Database query error:", error);
    throw error;
  }
};

// Helper function for transactions
const transaction = async (callback) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  pool,
  query,
  transaction,
};
