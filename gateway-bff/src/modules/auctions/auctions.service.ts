import DataLoader from 'dataloader';
import type { CatalogService, Item } from '../catalog/index.js';
import type { Auction, AuctionClient } from './auction.client.js';

export interface AuctionLoaders {
  auctionByItemId: DataLoader<string, Auction | null>;
  auctionById: DataLoader<string, Auction | null>;
  item: DataLoader<string, Item | null>;
}

export class AuctionsService {
  constructor(
    private readonly auctionClient: AuctionClient,
    private readonly catalogService: CatalogService,
  ) {}

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
