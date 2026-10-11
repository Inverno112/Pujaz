import DataLoader from 'dataloader';
import type { GatewayPubSub } from '../../core/pubsub.js';
import type { CatalogService, Item, NewItem } from '../catalog/index.js';
import type { Auction, AuctionClient, Bid } from './auction.client.js';

// Si la SPA no envía endsAt, la subasta dura dos semanas. El Gateway no pone tope a la fecha:
// las reglas sobre ella (por ejemplo, que no esté en el pasado) son del MS.
export const DEFAULT_AUCTION_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

// Lo que llega de GraphQL (CreateItemInput).
export interface CreateItemInput {
  name: string;
  description?: string | null;
  category?: string | null;
  images?: string[] | null;
  documents?: string[] | null;
  basePrice: number;
  endsAt?: string | null;
}

export interface CreatedItem {
  item: Item;
  auction: Auction;
}

export interface AuctionLoaders {
  auctionByItemId: DataLoader<string, Auction | null>;
  auctionById: DataLoader<string, Auction | null>;
  item: DataLoader<string, Item | null>;
}

export class AuctionsService {
  constructor(
    private readonly auctionClient: AuctionClient,
    private readonly catalogService: CatalogService,
    private readonly pubsub: GatewayPubSub,
  ) {}

  // Puja en el MS y, solo si se acepta, avisa a quienes siguen esa subasta (rest.md §3).
  // Si el MS rechaza la puja, el error sube tal cual y no se publica nada.
  async placeBid(userId: string, auctionId: string, amount: number): Promise<Bid> {
    const { bid, auction } = await this.auctionClient.placeBid(auctionId, userId, amount);
    this.pubsub.publish('auctionUpdated', auction.id, auction);
    return bid;
  }

  subscribeToAuction(auctionId: string) {
    return this.pubsub.subscribe('auctionUpdated', auctionId);
  }

  // Crea el ítem en el MS catálogo y luego su subasta en el MS transaccional (rest.md §3).
  // Si la subasta falla, el ítem queda sin subasta: no hay compensación automática en el prototipo,
  // solo se deja registrado.
  async createItem(input: CreateItemInput): Promise<CreatedItem> {
    const item = await this.catalogService.createItem(toNewItem(input));
    const endsAt = input.endsAt ?? new Date(Date.now() + DEFAULT_AUCTION_DURATION_MS).toISOString();
    try {
      const auction = await this.auctionClient.createAuction({ itemId: item.id, basePrice: item.basePrice, endsAt });
      return { item, auction };
    } catch (error) {
      console.error(`[gateway] el ítem ${item.id} se creó pero su subasta no: queda sin subasta.`, error);
      throw error;
    }
  }

  // Cargadores de una petición: todos los Item.auction, WalletMovement.auction (o Auction.item)
  // de una consulta se resuelven con una sola llamada al MS.
  createLoaders(): AuctionLoaders {
    return {
      auctionByItemId: new DataLoader(async (itemIds) => {
        const auctions = await this.auctionClient.getAuctionsByItemIds([...itemIds]);
        const byItemId = new Map(auctions.map((auction) => [auction.itemId, auction]));
        return itemIds.map((itemId) => byItemId.get(itemId) ?? null);
      }),
      auctionById: new DataLoader(async (ids) => {
        const auctions = await this.auctionClient.getAuctionsByIds([...ids]);
        const byId = new Map(auctions.map((auction) => [auction.id, auction]));
        return ids.map((id) => byId.get(id) ?? null);
      }),
      item: this.catalogService.createItemLoader(),
    };
  }
}

// Solo los campos que llegan con valor: null en GraphQL significa "no enviado".
function toNewItem(input: CreateItemInput): NewItem {
  const item: NewItem = { name: input.name, basePrice: input.basePrice };
  if (input.description != null) item.description = input.description;
  if (input.category != null) item.category = input.category;
  if (input.images != null) item.images = input.images;
  if (input.documents != null) item.documents = input.documents;
  return item;
}
