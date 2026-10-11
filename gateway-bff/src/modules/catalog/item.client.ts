// Contrato con el MS catálogo para ítems (rest.md §2).

export interface Item {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  images: string[];
  documents: string[];
  basePrice: number;
}

export interface ItemClient {
  /** GET /items?search= · busca en nombre y descripción, sin distinguir mayúsculas */
  searchItems(search?: string): Promise<Item[]>;
  /** GET /items/{itemId} · Errores: NOT_FOUND */
  getItem(itemId: string): Promise<Item>;
  /** GET /items?ids= · los ids que no existen no aparecen */
  getItemsByIds(ids: string[]): Promise<Item[]>;
}
