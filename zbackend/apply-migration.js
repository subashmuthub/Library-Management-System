/**
 * Apply a single migration file directly to the database.
 * Usage: node apply-migration.js <migration_file.sql>
 */

const fs = require('fs');
const path = require('path');
const { query } = require('./src/config/database');

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: node apply-migration.js <migration_file.sql>');
  process.exit(1);
}

const fullPath = path.resolve(__dirname, 'database/migrations', migrationFile);
if (!fs.existsSync(fullPath)) {
  console.error('File not found:', fullPath);
  process.exit(1);
}

async function run() {
  const sql = fs.readFileSync(fullPath, 'utf8');
  // Split on semicolons, skip empty/comment-only lines
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length && !s.startsWith('--'));

  for (const stmt of statements) {
    try {
      await query(stmt);
      console.log('  ✅', stmt.substring(0, 60).replace(/\n/g, ' '), '...');
    } catch (err) {
      console.error('  ❌ Error:', err.message);
      console.error('     SQL:', stmt.substring(0, 100));
    }
  }
  console.log('Done.');
  process.exit(0);
}

run();
