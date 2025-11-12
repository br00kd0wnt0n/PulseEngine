import crypto from 'crypto';

// Generate a secure 32-byte (256-bit) encryption key
const generateDataKey = () => {
  return crypto.randomBytes(32).toString('hex');
};

const DATA_KEY = generateDataKey();

console.log('Generated secure 256-bit encryption key:');
console.log('');
console.log('Add this to your .env file:');
console.log(`DATA_KEY=${DATA_KEY}`);
console.log('');
console.log('For key rotation, use versioned keys:');
console.log(`DATA_KEY_V1=${DATA_KEY}`);
console.log(`DATA_KEY_ID=v1`);
console.log('');
console.log('⚠️  Keep this key secure and never commit it to version control!');
