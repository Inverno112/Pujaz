import type { Item, ItemClient } from '../../../modules/catalog/index.js';
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
}
