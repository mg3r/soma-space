#!/usr/bin/env node

/**
 * Migration script to backfill existing Stripe registrations to Supabase
 * 
 * Usage:
 *   node run-migration.js YOUR_ADMIN_PASSWORD
 * 
 * Or set ADMIN_PASSWORD env var:
 *   ADMIN_PASSWORD=your_password node run-migration.js
 */

const adminPassword = process.argv[2] || process.env.ADMIN_PASSWORD;
const baseUrl = process.env.BASE_URL || 'https://entersoma.space';

if (!adminPassword) {
  console.error('❌ Error: Admin password required');
  console.error('\nUsage:');
  console.error('  node run-migration.js YOUR_ADMIN_PASSWORD');
  console.error('  or');
  console.error('  ADMIN_PASSWORD=your_password node run-migration.js');
  process.exit(1);
}

console.log('🚀 Starting migration...');
console.log(`📍 Target: ${baseUrl}/api/admin/migrate-registrations\n`);

fetch(`${baseUrl}/api/admin/migrate-registrations`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminPassword}`,
    'Content-Type': 'application/json',
  },
})
  .then(async (res) => {
    const data = await res.json();
    
    if (!res.ok) {
      console.error('❌ Migration failed:');
      console.error(JSON.stringify(data, null, 2));
      process.exit(1);
    }
    
    if (data.success) {
      console.log('✅ Migration successful!\n');
      console.log(`   Migrated: ${data.migrated} registrations`);
      console.log(`   Skipped:  ${data.skipped} sessions`);
      console.log(`   Errors:   ${data.errors}`);
      console.log(`\n   ${data.message}`);
      console.log('\n✨ Check your admin dashboard to see the registrations!');
    } else {
      console.error('❌ Migration returned unsuccessful:');
      console.error(JSON.stringify(data, null, 2));
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error('❌ Error running migration:');
    console.error(err.message);
    process.exit(1);
  });

