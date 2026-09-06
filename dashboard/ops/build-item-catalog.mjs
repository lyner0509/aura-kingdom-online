import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
if (args.length < 2) throw new Error('Usage: node build-item-catalog.mjs SOURCE... DESTINATION');
const destination = args[args.length - 1];
const sources = args.slice(0, -1);

const catalog = Object.create(null);
for (const source of sources) {
  for (const line of (await readFile(source, 'utf8')).split(/\r?\n/)) {
    const [id, name] = line.split('|', 2);
    if (/^\d+$/.test(id) && name?.trim()) catalog[id] = name.trim();
  }
}
if (!Object.keys(catalog).length) throw new Error('No item names found in source files');
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, JSON.stringify(catalog));
