import { randomBytes, scryptSync } from 'node:crypto';

const password = process.argv[2];
if (!password || password.length < 12) {
  console.error('Usage: npm run password -- "a-password-with-at-least-12-characters"');
  process.exit(1);
}

const salt = randomBytes(16).toString('hex');
const derived = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
console.log(`$scrypt$16384$8$1$${salt}$${derived.toString('hex')}`);
