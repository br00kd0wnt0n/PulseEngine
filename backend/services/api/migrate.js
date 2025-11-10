// Simple migration runner for Railway
// Run with: node migrate.js

require('reflect-metadata');

async function runMigrations() {
  console.log('Starting database migrations...');

  try {
    const { AppDataSource } = require('./dist/db/data-source');

    console.log('Initializing database connection...');
    await AppDataSource.initialize();
    console.log('Connected to database');

    console.log('Running migrations...');
    const migrations = await AppDataSource.runMigrations();

    if (migrations.length === 0) {
      console.log('No migrations to run - database is up to date');
    } else {
      console.log(`Successfully ran ${migrations.length} migration(s):`);
      migrations.forEach(m => console.log(`  - ${m.name}`));
    }

    await AppDataSource.destroy();
    console.log('Database connection closed');
    console.log('✅ Migrations completed successfully');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:');
    console.error(error);
    process.exit(1);
  }
}

runMigrations();
