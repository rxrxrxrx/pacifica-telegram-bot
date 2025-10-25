#!/usr/bin/env node

// Script to generate a secure encryption key for the Pacifica Telegram Bot
const crypto = require('crypto');

console.log('🔐 Pacifica Telegram Bot - Encryption Key Generator\n');

// Generate a 32-byte (256-bit) key and convert to hex
const encryptionKey = crypto.randomBytes(32).toString('hex');

console.log('Generated 64-character encryption key:');
console.log(encryptionKey);
console.log('\nAdd this to your .env file:');
console.log(`ENCRYPTION_KEY=${encryptionKey}`);
console.log('\n⚠️  IMPORTANT: Keep this key secure and never share it!');
console.log('⚠️  If you lose this key, all encrypted private keys will be unrecoverable!');
