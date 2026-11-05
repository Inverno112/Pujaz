import type { Auction, AuctionClient, NewAuction, PlacedBid } from '../../../modules/auctions/index.js';
import { parseAuction, parseListOf, parsePlacedBid } from '../../http/contract.js';
import type { HttpClient } from '../../http/http-client.js';

// MS transaccional, rest.md §1.3.
export class HttpAuctionClient implements AuctionClient {
  constructor(private readonly http: HttpClient) {}

  async getAuctionsByItemIds(itemIds: string[]): Promise<Auction[]> {
    if (itemIds.length === 0) return [];
    return this.http.get(
      `/auctions?itemIds=${joinIds(itemIds)}`,
      parseListOf(parseAuction, (auction) => auction.itemId, itemIds),
    );
  }

  async getAuctionsByIds(ids: string[]): Promise<Auction[]> {
    if (ids.length === 0) return [];
    return this.http.get(`/auctions?ids=${joinIds(ids)}`, parseListOf(parseAuction, (auction) => auction.id, ids));
  }

  placeBid(auctionId: string, userId: string, amount: number): Promise<PlacedBid> {
    return this.http.post(`/auctions/${encodeURIComponent(auctionId)}/bids`, { userId, amount }, parsePlacedBid);
  }

  createAuction(input: NewAuction): Promise<Auction> {
    return this.http.post('/auctions', input, parseAuction);
  }
}

function joinIds(ids: string[]): string {
  return ids.map(encodeURIComponent).join(',');
}
