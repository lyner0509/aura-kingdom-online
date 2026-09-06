import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const [source, destination] = process.argv.slice(2);
if (!source || !destination) throw new Error('Usage: node build-item-catalog.mjs SOURCE DESTINATION');
const catalog = Object.create(null);
for (const line of (await readFile(source, 'utf8')).split(/\r?\n/)) {
  const [id, name] = line.split('|', 3);
  if (/^\d+$/.test(id) && name?.trim()) catalog[id] = name.trim();
}
if (!Object.keys(catalog).length) throw new Error(`No item names found in ${source}`);
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, JSON.stringify(catalog));
