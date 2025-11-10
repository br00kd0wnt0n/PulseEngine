require('reflect-metadata');

async function checkTables() {
  console.log('Checking database tables...');

  try {
    const { AppDataSource } = require('./dist/src/db/data-source');

    await AppDataSource.initialize();
    console.log('✅ Connected to database');

    // Check migrations table
    const migrations = await AppDataSource.query('SELECT * FROM migrations ORDER BY timestamp');
    console.log('\n📋 Migrations run:', migrations.length);
    migrations.forEach(m => console.log(`  - ${m.name}`));

    // Check all tables
    const tables = await AppDataSource.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log('\n📊 Tables in database:', tables.length);
    tables.forEach(t => console.log(`  - ${t.table_name}`));

    // Check users table
    const userCount = await AppDataSource.query('SELECT COUNT(*) as count FROM users');
    console.log(`\n👥 Users table: ${userCount[0].count} rows`);

    // Check creators table
    const creatorCount = await AppDataSource.query('SELECT COUNT(*) as count FROM creators');
    console.log(`🎨 Creators table: ${creatorCount[0].count} rows`);

    // Check trends table
    const trendCount = await AppDataSource.query('SELECT COUNT(*) as count FROM trends');
    console.log(`📈 Trends table: ${trendCount[0].count} rows`);

    // Check content_assets table
    const assetCount = await AppDataSource.query('SELECT COUNT(*) as count FROM content_assets');
    console.log(`📁 Content Assets table: ${assetCount[0].count} rows`);

    await AppDataSource.destroy();
    console.log('\n✅ Database check complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkTables();
