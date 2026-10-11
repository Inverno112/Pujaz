import type { Item, ItemClient, NewItem } from '../../../modules/catalog/index.js';
import { MISSING_CREATE_AUCTION, createNotAvailable } from './not-available.js';
import { parseItem, parseList, parseListOf } from '../../http/contract.js';
import type { HttpClient } from '../../http/http-client.js';

// MS catálogo, rest.md §2.
export class HttpItemClient implements ItemClient {
  constructor(private readonly http: HttpClient) {}

  searchItems(search?: string): Promise<Item[]> {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.http.get(`/items${query}`, parseList(parseItem));
  }

  getItem(itemId: string): Promise<Item> {
    return this.http.get(`/items/${encodeURIComponent(itemId)}`, parseItem);
  }

  async getItemsByIds(ids: string[]): Promise<Item[]> {
    if (ids.length === 0) return [];
    return this.http.get(
      `/items?ids=${ids.map(encodeURIComponent).join(',')}`,
      parseListOf(parseItem, (item) => item.id, ids),
    );
  }

  // Pendiente: se habilita junto con POST /auctions del MS transaccional. Crear el ítem sin poder
  // crear su subasta lo dejaría huérfano en el catálogo. Cuando exista:
  // return this.http.post('/items', input, parseItem);
  async createItem(_input: NewItem): Promise<Item> {
    throw createNotAvailable('MS catálogo POST /items', MISSING_CREATE_AUCTION);
  }
}
