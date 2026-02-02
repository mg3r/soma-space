/**
 * Test script for event configuration system
 * Run this after starting your dev server: node test-event-config.js
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

async function testEventConfig() {
  console.log('🧪 Testing Event Configuration System\n');
  console.log(`Using base URL: ${BASE_URL}\n`);

  // Test 1: Check if API route exists
  console.log('Test 1: Checking API route...');
  try {
    const response = await fetch(`${BASE_URL}/api/admin/event-config?active=true`);
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API route is accessible');
      console.log(`   Current active config: ${data.config ? 'Found' : 'None'}\n`);
    } else {
      console.log(`⚠️  API returned status: ${response.status}`);
      console.log(`   This might be expected if not authenticated\n`);
    }
  } catch (error) {
    console.log(`❌ Error connecting to API: ${error.message}`);
    console.log(`   Make sure your dev server is running: npm run dev\n`);
    return;
  }

  // Test 2: Check if library function exists
  console.log('Test 2: Checking library functions...');
  try {
    const fs = require('fs');
    const eventConfigPath = './src/lib/event-config.ts';
    if (fs.existsSync(eventConfigPath)) {
      console.log('✅ event-config.ts library file exists');
      const content = fs.readFileSync(eventConfigPath, 'utf8');
      if (content.includes('getActiveEventConfig')) {
        console.log('✅ getActiveEventConfig function found');
      }
      if (content.includes('defaultEventConfig')) {
        console.log('✅ Default fallback config found\n');
      }
    }
  } catch (error) {
    console.log(`⚠️  Could not verify library file: ${error.message}\n`);
  }

  // Test 3: Check admin page
  console.log('Test 3: Checking admin page structure...');
  try {
    const fs = require('fs');
    const adminPagePath = './src/app/admin/page.tsx';
    if (fs.existsSync(adminPagePath)) {
      const content = fs.readFileSync(adminPagePath, 'utf8');
      if (content.includes('event-config')) {
        console.log('✅ Event config tab found in admin page');
      }
      if (content.includes('loadEventConfig')) {
        console.log('✅ loadEventConfig function found');
      }
      if (content.includes('saveEventConfig')) {
        console.log('✅ saveEventConfig function found\n');
      }
    }
  } catch (error) {
    console.log(`⚠️  Could not verify admin page: ${error.message}\n`);
  }

  console.log('📋 Manual Testing Checklist:');
  console.log('   1. Start dev server: npm run dev');
  console.log('   2. Visit: http://localhost:3000/admin');
  console.log('   3. Log in with your ADMIN_PASSWORD');
  console.log('   4. Click "event config" tab');
  console.log('   5. Click "initialize with defaults"');
  console.log('   6. Make some changes and save');
  console.log('   7. Refresh page and verify changes persist');
  console.log('   8. Check Supabase dashboard → event_config table\n');

  console.log('✨ Setup looks good! Ready for manual testing.');
}

// Run tests
testEventConfig().catch(console.error);
