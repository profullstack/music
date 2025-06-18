/**
 * Main entry point for the Music Publisher CLI
 * Exports the main classes for programmatic use
 */

export { CLI } from './cli.js';
export { Publisher } from './services/publisher.js';
export { FugaClient } from './api/fuga-client.js';
export { TuneCoreClient } from './api/tunecore-client.js';
export { FileScanner } from './utils/file-scanner.js';
export { MetadataScanner } from './utils/metadata-scanner.js';