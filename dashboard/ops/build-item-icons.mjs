import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
if (args.length < 2) throw new Error('Usage: node build-item-icons.mjs SOURCE DESTINATION');
const [source, destination] = args;

const mapping = Object.create(null);
const content = await readFile(source, 'latin1');
for (const line of content.split(/\r?\n/)) {
  const parts = line.split('|');
  if (parts.length > 1 && /^\d+$/.test(parts[0])) {
    const id = parts[0];
    const icon = parts[1].trim().toLowerCase();
    if (icon) {
      mapping[id] = icon;
    }
  }
}

if (!Object.keys(mapping).length) throw new Error('No item icons found in source file');
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, JSON.stringify(mapping));
