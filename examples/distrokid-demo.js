#!/usr/bin/env node

/**
 * DistroKid Form Filler Demo
 * 
 * This script demonstrates how to use the DistroKid Form Filler
 * to automatically fill out the DistroKid upload form.
 * 
 * Usage:
 *   node examples/distrokid-demo.js
 * 
 * Make sure to update the configuration with your actual credentials
 * and track information before running.
 */

import { DistroKidFormFiller } from '../src/services/distrokid-form-filler.js';

async function runDemo() {
  console.log('🎵 DistroKid Form Filler Demo');
  console.log('================================\n');

  // Configuration - UPDATE THESE VALUES
  const config = {
    email: 'your-email@example.com',        // Your DistroKid email
    password: 'your-password',              // Your DistroKid password
    timeout: 30000,
    screenshotPath: './screenshots/demo'
  };

  // Track data - UPDATE THESE VALUES
  const trackData = {
    title: 'Blood in the Algorithm',
    artist: 'Velocity Vibe',
    filePath: './Velocity Vibe/Circuits of Dissent/001-Blood in the Algorithm-Circuits of Dissent.wav',
    explicit: false,
    instrumental: false,
    isRadioEdit: false,
    isCoverSong: false,
    songwriters: [
      {
        role: 'Music and lyrics',
        firstName: 'John',
        middleName: '',
        lastName: 'Doe'
      }
    ],
    featuredArtists: [],
    versionInfo: null,
    previewStartTime: null,
    price: 'Track Mid',
    dolbyAtmos: false
  };

  console.log('⚠️  IMPORTANT: Update the configuration above with your actual:');
  console.log('   • DistroKid email and password');
  console.log('   • Track title, artist, and file path');
  console.log('   • Songwriter information\n');

  // Validate configuration
  if (config.email === 'your-email@example.com') {
    console.error('❌ Please update the email in the configuration');
    process.exit(1);
  }

  if (config.password === 'your-password') {
    console.error('❌ Please update the password in the configuration');
    process.exit(1);
  }

  if (!trackData.filePath || trackData.filePath.startsWith('./Velocity Vibe/')) {
    console.error('❌ Please update the audio file path in the configuration');
    process.exit(1);
  }

  let formFiller;

  try {
    console.log('🚀 Initializing DistroKid Form Filler...');
    
    // Create form filler instance
    formFiller = new DistroKidFormFiller(config);
    
    // Initialize and authenticate
    await formFiller.initialize();
    
    console.log('📝 Filling form with track data...');
    console.log(`   Track: "${trackData.title}" by ${trackData.artist}`);
    console.log(`   File: ${trackData.filePath}\n`);
    
    // Fill form and wait for user submission
    const result = await formFiller.fillFormAndWaitForSubmission(trackData);
    
    console.log('\n📊 Results:');
    console.log('===========');
    
    if (result.success) {
      console.log('✅ Form filled successfully!');
      
      if (result.submitted) {
        console.log('🎉 Form was submitted by user!');
        console.log(`📍 Final URL: ${result.finalUrl}`);
      } else {
        console.log('ℹ️  Form was filled but not submitted');
        console.log(`📝 Reason: ${result.reason || 'User interaction required'}`);
      }
    } else {
      console.log('❌ Form filling failed');
      console.log(`💥 Error: ${result.error}`);
    }
    
    console.log(`🕒 Completed at: ${result.timestamp || new Date().toISOString()}`);
    
  } catch (error) {
    console.error('\n❌ Demo failed:');
    console.error(`💥 ${error.message}`);
    
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
  } finally {
    // Cleanup
    if (formFiller) {
      console.log('\n🧹 Cleaning up...');
      await formFiller.close();
    }
  }
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo().catch(error => {
    console.error('Demo crashed:', error);
    process.exit(1);
  });
}

export { runDemo };