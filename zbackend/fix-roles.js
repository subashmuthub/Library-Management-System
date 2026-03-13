/**
 * Fix Script: Insert missing user_roles data
 * Run: node fix-roles.js
 */

const mysql = require("mysql2/promise");
require("dotenv").config();

async function fixRoles() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "smart_library",
  });

  try {
    console.log("=".repeat(50));
    console.log("Fixing missing user_roles data...");
    console.log("=".repeat(50));

    // Clear and re-insert roles
    await pool.query("DELETE FROM user_roles");
    await pool.query(`
      INSERT INTO user_roles (id, role_name, description, permissions) VALUES
      (1, 'admin', 'System administrator with full access', '{"users":["create","read","update","delete"],"books":["create","read","update","delete"],"transactions":["create","read","update","delete"],"fines":["create","read","update","delete"]}'),
      (2, 'librarian', 'Library staff with administrative access', '{"users":["read","update"],"books":["create","read","update"],"transactions":["create","read","update"],"fines":["read","update"]}'),
      (3, 'student', 'Student user with basic access', '{"books":["read"],"transactions":["read"],"reservations":["create","read","update"]}')
    `);

    console.log("✅ user_roles inserted successfully");

    // Verify roles
    const [roles] = await pool.query(
      "SELECT id, role_name, description FROM user_roles",
    );
    console.log("\nCurrent user_roles:");
    console.table(roles);

    // Test the JOIN query used by login
    const [joinTest] = await pool.query(`
      SELECT u.email, u.first_name, u.role_id, r.role_name 
      FROM users u 
      JOIN user_roles r ON u.role_id = r.id 
      LIMIT 5
    `);
    console.log("\nJOIN test (used by login):");
    console.table(joinTest);

    if (joinTest.length > 0) {
      console.log("\n✅ Login query JOIN is working correctly!");
      console.log("✅ You can now login with:");
      console.log("   Email:    admin@library.edu");
      console.log("   Password: password123");
    } else {
      console.log("\n❌ JOIN test failed - no results");
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await pool.end();
  }
}

fixRoles();
