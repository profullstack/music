#!/usr/bin/env node

/**
 * Configuration Generator Demo
 * 
 * This script demonstrates how to use the ConfigGenerator
 * to create track and album configuration files.
 * 
 * Usage:
 *   node examples/config-demo.js
 */

import { ConfigGenerator } from '../src/services/config-generator.js';

async function runDemo() {
  console.log('🎵 Configuration Generator Demo');
  console.log('===============================\n');

  const configGenerator = new ConfigGenerator({
    outputDir: './demo-configs'
  });

  try {
    console.log('📝 Creating sample track configuration...\n');

    // Create a sample track configuration
    const trackData = {
      email: 'demo@example.com',
      password: 'demo-password',
      title: 'Demo Track',
      artist: 'Demo Artist',
      filePath: './demo-audio.wav',
      explicit: false,
      instrumental: false,
      songwriterFirstName: 'John',
      songwriterLastName: 'Doe'
    };

    const trackResult = await configGenerator.generateTrackConfig(trackData);
    
    console.log('✅ Track configuration created!');
    console.log(`📁 Saved to: ${trackResult.configPath}`);
    console.log(`💡 Usage: node src/cli.js distrokid-fill --config "${trackResult.configPath}"\n`);

    console.log('📀 Creating sample album configuration...\n');

    // Create a sample album configuration
    const albumData = {
      title: 'Demo Album',
      artist: 'Demo Artist',
      style: 'pop',
      tracks: [
        {
          title: 'Track One',
          lyricsPath: './lyrics/track1.txt',
          style: 'pop'
        },
        {
          title: 'Track Two',
          lyricsPath: './lyrics/track2.txt',
          style: 'rock'
        }
      ]
    };

    const albumResult = await configGenerator.generateAlbumConfig(albumData);
    
    console.log('✅ Album configuration created!');
    console.log(`📁 Saved to: ${albumResult.configPath}`);
    console.log(`💡 Usage: node src/cli.js generate --album "${albumResult.configPath}"\n`);

    console.log('🎉 Demo completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Edit the generated configuration files with your actual data');
    console.log('2. Use the CLI commands shown above to use the configurations');
    console.log('3. Or create new configurations interactively:');
    console.log('   • node src/cli.js create-track-config');
    console.log('   • node src/cli.js create-album-config');

  } catch (error) {
    console.error('\n❌ Demo failed:');
    console.error(`💥 ${error.message}`);
    
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
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