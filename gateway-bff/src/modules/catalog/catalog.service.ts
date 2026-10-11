import DataLoader from 'dataloader';
import { AppError } from '../../core/errors.js';
import type { Item, ItemClient } from './item.client.js';

export class CatalogService {
  constructor(private readonly itemClient: ItemClient) {}

  searchItems(search?: string): Promise<Item[]> {
    return this.itemClient.searchItems(search);
  }

  // Query.item devuelve null si el ítem no existe.
  async getItem(itemId: string): Promise<Item | null> {
    try {
      return await this.itemClient.getItem(itemId);
    } catch (error) {
      if (error instanceof AppError && error.code === 'NOT_FOUND') return null;
      throw error;
    }
  }

  // Un cargador por petición: junta todos los ids pedidos y hace una sola llamada.
  createItemLoader(): DataLoader<string, Item | null> {
    return new DataLoader(async (ids) => {
      const items = await this.itemClient.getItemsByIds([...ids]);
      const byId = new Map(items.map((item) => [item.id, item]));
      return ids.map((id) => byId.get(id) ?? null);
    });
  }
}
