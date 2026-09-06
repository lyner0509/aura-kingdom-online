import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

export interface IndexedItem {
  id: number;
  name: string;
  category: string;
  is_bound: boolean;
}

interface InternalCachedItem extends IndexedItem {
  idStr: string;
  lowerName: string;
}

export interface ItemIndexQueryOptions {
  q?: string;
  page?: number;
  limit?: number;
  category?: string;
  tradable?: 'all' | 'tradable' | 'non_tradable';
  sort?: 'id_asc' | 'id_desc' | 'name_asc' | 'name_desc';
}

export interface ItemIndexResult {
  items: IndexedItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  categories: Array<{ name: string; count: number }>;
  stats: {
    totalItems: number;
    tradableCount: number;
    boundCount: number;
  };
}

export function classifyItem(id: number, name: string): { category: string; is_bound: boolean } {
  const lower = name.toLowerCase();
  const is_bound =
    lower.includes('(non-tradable)') ||
    lower.includes('(untradable)') ||
    lower.includes('(bound)');

  let category = 'Other';

  if (lower.includes('secret stone')) {
    category = 'Secret Stone';
  } else if (
    lower.includes('eidolon') ||
    lower.includes('key of gaia') ||
    lower.includes('gaia fragment') ||
    lower.includes('spirit:')
  ) {
    category = 'Eidolon';
  } else if (
    lower.includes('mount') ||
    lower.includes('ethereal wolf') ||
    lower.includes('beast') ||
    lower.includes('chocobo')
  ) {
    category = 'Mount';
  } else if (
    lower.startsWith('costume') ||
    lower.startsWith('custom') ||
    lower.startsWith('head:') ||
    lower.startsWith('face:') ||
    lower.startsWith('body:') ||
    lower.startsWith('back:') ||
    lower.startsWith('weapon:') ||
    lower.includes('costume') ||
    (id >= 50000 && id < 60000)
  ) {
    category = 'Costume';
  } else if (
    (id >= 10000 && id < 20000) ||
    lower.includes('sword') ||
    lower.includes('axe') ||
    lower.includes('staff') ||
    lower.includes('pistol') ||
    lower.includes('cannon') ||
    lower.includes('katar') ||
    lower.includes('bow') ||
    lower.includes('grimoire') ||
    lower.includes('harp') ||
    lower.includes('tachi') ||
    lower.includes('scythe') ||
    lower.includes('shuriken') ||
    lower.includes('lance')
  ) {
    category = 'Weapon';
  } else if (
    (id >= 20000 && id < 40000) ||
    lower.includes('helmet') ||
    lower.includes('armor') ||
    lower.includes('belt') ||
    lower.includes('boots') ||
    lower.includes('gloves') ||
    lower.includes('ring') ||
    lower.includes('necklace') ||
    lower.includes('cloak') ||
    lower.includes('trophy')
  ) {
    category = 'Armor & Gear';
  } else if (lower.includes('backpack') || lower.includes('bag')) {
    category = 'Bag';
  } else if (
    lower.includes('potion') ||
    lower.includes('crystal') ||
    lower.includes('card') ||
    lower.includes('scroll') ||
    lower.includes('stone') ||
    lower.includes('feather') ||
    lower.includes('solution') ||
    lower.includes('charm') ||
    lower.includes('badge') ||
    (id >= 40000 && id < 50000)
  ) {
    category = 'Consumable';
  } else if (
    lower.includes('recipe') ||
    lower.includes('formula') ||
    lower.includes('material') ||
    lower.includes('ore') ||
    lower.includes('wood') ||
    lower.includes('fish') ||
    lower.includes('meat')
  ) {
    category = 'Material';
  }

  return { category, is_bound };
}

let cachedItemsPromise: Promise<InternalCachedItem[]> | undefined;

export async function loadItemCatalog(): Promise<InternalCachedItem[]> {
  if (cachedItemsPromise) {
    return cachedItemsPromise;
  }

  cachedItemsPromise = (async () => {
    const candidatePaths = [
      process.env.ITEM_CATALOG_PATH,
      'data/item-names.json',
      '/opt/aura-dashboard/current/data/item-names.json',
    ].filter(Boolean) as string[];

    let rawJson = '';
    for (const p of candidatePaths) {
      if (existsSync(p)) {
        try {
          rawJson = await readFile(p, 'utf8');
          break;
        } catch {
          // try next
        }
      }
    }

    if (!rawJson) {
      return [];
    }

    try {
      const catalogObj = JSON.parse(rawJson) as Record<string, string>;
      const items: InternalCachedItem[] = [];

      for (const [idStr, name] of Object.entries(catalogObj)) {
        const id = Number(idStr);
        if (!Number.isSafeInteger(id) || id <= 0) continue;
        const cleanName = (name || '').trim();
        const { category, is_bound } = classifyItem(id, cleanName);

        items.push({
          id,
          name: cleanName,
          category,
          is_bound,
          idStr: String(id),
          lowerName: cleanName.toLowerCase(),
        });
      }

      // Default sort by ID ascending
      items.sort((a, b) => a.id - b.id);
      return items;
    } catch {
      return [];
    }
  })();

  return cachedItemsPromise;
}

export async function queryItemIndex(options: ItemIndexQueryOptions = {}): Promise<ItemIndexResult> {
  const allItems = await loadItemCatalog();

  const q = (options.q || '').trim().toLowerCase();
  const category = (options.category || 'all').trim();
  const tradable = options.tradable || 'all';
  const sort = options.sort || 'id_asc';
  const rawLimit = Number(options.limit) || 48;
  const limit = Math.max(1, Math.min(rawLimit, 100));
  const reqPage = Math.max(1, Number(options.page) || 1);

  // Compute catalog stats
  let totalTradable = 0;
  let totalBound = 0;
  const catCountMap: Record<string, number> = {};

  for (const it of allItems) {
    if (it.is_bound) totalBound++;
    else totalTradable++;
    catCountMap[it.category] = (catCountMap[it.category] || 0) + 1;
  }

  // Filter
  let filtered = allItems;

  if (q) {
    filtered = filtered.filter((it) => it.idStr.includes(q) || it.lowerName.includes(q));
  }

  if (category && category.toLowerCase() !== 'all') {
    filtered = filtered.filter((it) => it.category.toLowerCase() === category.toLowerCase());
  }

  if (tradable === 'tradable') {
    filtered = filtered.filter((it) => !it.is_bound);
  } else if (tradable === 'non_tradable') {
    filtered = filtered.filter((it) => it.is_bound);
  }

  // Sort
  if (sort === 'id_desc') {
    filtered = [...filtered].sort((a, b) => b.id - a.id);
  } else if (sort === 'name_asc') {
    filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === 'name_desc') {
    filtered = [...filtered].sort((a, b) => b.name.localeCompare(a.name));
  } else {
    // id_asc
    if (filtered !== allItems) {
      filtered = [...filtered].sort((a, b) => a.id - b.id);
    }
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(reqPage, totalPages);
  const offset = (page - 1) * limit;
  const paged = filtered.slice(offset, offset + limit).map(({ id, name, category: cat, is_bound }) => ({
    id,
    name,
    category: cat,
    is_bound,
  }));

  const categories = Object.entries(catCountMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return {
    items: paged,
    total,
    page,
    limit,
    totalPages,
    categories,
    stats: {
      totalItems: allItems.length,
      tradableCount: totalTradable,
      boundCount: totalBound,
    },
  };
}
