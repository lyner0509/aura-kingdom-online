import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
if (args.length < 2) throw new Error('Usage: node build-item-icons.mjs SOURCE... DESTINATION');
const destination = args[args.length - 1];
const sources = args.slice(0, -1);

const mapping = Object.create(null);
const enchants = Object.create(null);
const spells = Object.create(null);
const combines = Object.create(null);

// Parse sources
for (const source of sources) {
  if (!existsSync(source)) continue;
  const content = await readFile(source, 'latin1');
  const isEnchant = /enchant/i.test(source);
  const isSpell = /spell/i.test(source);
  const isCombine = /combine/i.test(source);

  for (const line of content.split(/\r?\n/)) {
    const parts = line.split('|');
    if (!parts || !parts[0] || !/^\d+$/.test(parts[0])) continue;
    const id = parts[0];

    if (isEnchant) {
      let icon = parts[1]?.trim().toLowerCase();
      if (!icon) {
        for (const col of parts) {
          const c = col?.trim().toLowerCase();
          if (c && /^[a-z]\d{5}$/.test(c)) {
            icon = c;
            break;
          }
        }
      }
      if (icon) enchants[id] = icon;
      continue;
    }

    if (isSpell) {
      const icon = parts[1]?.trim().toLowerCase();
      if (icon) spells[id] = icon;
      continue;
    }

    if (isCombine) {
      if (parts.length > 13) {
        const crafted = parts[6]?.trim();
        const recipe = parts[10]?.trim();
        const mat = parts[13]?.trim();
        if (recipe && /^\d+$/.test(recipe)) {
          combines[recipe] = crafted && /^\d+$/.test(crafted) ? crafted : mat;
        }
      }
      continue;
    }

    // Standard item file (S_Item, S_ItemMall, c_item, c_itemmall)
    let icon = parts[1]?.trim().toLowerCase();
    if (!icon && parts.length > 2) {
      icon = parts[2]?.trim().toLowerCase();
    }
    if (!icon && parts.length > 21 && /^\d+$/.test(parts[21])) {
      const eid = parts[21];
      icon = enchants[eid] || spells[eid];
    }
    if (!icon && parts.length > 8) {
      const cat = parts[8]?.trim();
      if (cat === '90') icon = 'i70001';
      else if (cat === '61') icon = 'a30014';
      else if (cat === '57') icon = 'e60023';
    }

    if (icon) {
      mapping[id] = icon;
    }
  }
}

// Fallback recipe combines
for (const [recId, targetId] of Object.entries(combines)) {
  if (!mapping[recId] && mapping[targetId]) {
    mapping[recId] = mapping[targetId];
  }
}

if (!Object.keys(mapping).length) throw new Error('No item icons found in source files');
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, JSON.stringify(mapping));
console.log(`Generated ${Object.keys(mapping).length} item icons mapped to ${destination}`);
