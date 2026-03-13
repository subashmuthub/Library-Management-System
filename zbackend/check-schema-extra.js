const { query } = require('./src/config/database');

async function main() {
  try {
    const r = await query(
      "SELECT COUNT(*) as n FROM information_schema.tables WHERE table_schema='smart_library' AND table_name='library_config'"
    );
    console.log('library_config exists:', r[0].n === 1 ? 'YES' : 'NO');
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}
main();
