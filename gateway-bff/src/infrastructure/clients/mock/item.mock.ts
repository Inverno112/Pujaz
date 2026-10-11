import { AppError } from '../../../core/errors.js';
import type { Item, ItemClient, NewItem } from '../../../modules/catalog/index.js';

// Ids con formato de _id de MongoDB. El primero es el ejemplo de rest.md §2.
export const MOCK_ITEM_IDS = {
  watch: '64f1c0aa9b1e8a0012ab34cd',
  lamp: '64f1c0aa9b1e8a0012ab34ce',
  painting: '64f1c0aa9b1e8a0012ab34cf',
} as const;

const SEED_ITEMS: Item[] = [
  {
    id: MOCK_ITEM_IDS.watch,
    name: 'Reloj de bolsillo 1920',
    description: 'Plata, funcionando',
    category: 'Relojes',
    images: ['https://picsum.photos/seed/reloj/600/400'],
    documents: ['https://example.com/certificado-reloj.pdf'],
    basePrice: 100000,
  },
  {
    id: MOCK_ITEM_IDS.lamp,
    name: 'Lámpara de bronce art déco',
    description: 'Original de 1930, con pantalla de vidrio opalino',
    category: 'Iluminación',
    images: ['https://picsum.photos/seed/lampara/600/400'],
    documents: [],
    basePrice: 250000,
  },
  {
    id: MOCK_ITEM_IDS.painting,
    name: 'Pintura al óleo de paisaje',
    description: 'Paisaje andino, firmada, marco de madera tallada',
    category: 'Arte',
    images: ['https://picsum.photos/seed/pintura/600/400'],
    documents: [],
    basePrice: 800000,
  },
];

export class MockItemClient implements ItemClient {
  private readonly items: Item[] = SEED_ITEMS.map((item) => structuredClone(item));
  private nextId = 1;

  async searchItems(search?: string): Promise<Item[]> {
    if (!search) return this.items.map(copy);
    const term = search.toLowerCase();
    return this.items
      .filter((item) => item.name.toLowerCase().includes(term) || item.description?.toLowerCase().includes(term))
      .map(copy);
  }

  async getItem(itemId: string): Promise<Item> {
    const item = this.items.find((candidate) => candidate.id === itemId);
    if (!item) {
      throw new AppError('NOT_FOUND', 'El ítem no existe.');
    }
    return copy(item);
  }

  async getItemsByIds(ids: string[]): Promise<Item[]> {
    return this.items.filter((item) => ids.includes(item.id)).map(copy);
  }

  // Mismas reglas que el MS (rest.md §2): name no vacío y basePrice > 0.
  async createItem(input: NewItem): Promise<Item> {
    if (!input.name.trim()) {
      throw new AppError('BAD_USER_INPUT', 'El nombre del ítem es obligatorio.');
    }
    if (!(input.basePrice > 0)) {
      throw new AppError('BAD_USER_INPUT', 'El precio base debe ser mayor que cero.');
    }
    const item: Item = {
      // Id con formato de _id de MongoDB (24 caracteres hexadecimales).
      id: `65000000000000000000${(this.nextId++).toString(16).padStart(4, '0')}`,
      name: input.name,
      description: input.description ?? null,
      category: input.category ?? null,
      images: input.images ?? [],
      documents: input.documents ?? [],
      basePrice: input.basePrice,
    };
    this.items.push(item);
    return copy(item);
  }
}

function copy(item: Item): Item {
  return structuredClone(item);
}
