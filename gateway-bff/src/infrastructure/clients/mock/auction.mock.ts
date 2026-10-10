import type { Auction, AuctionClient, Bid, UserSummary } from '../../../modules/auctions/index.js';
import { MOCK_ITEM_IDS } from './item.mock.js';

const DAY = 24 * 60 * 60 * 1000;

interface StoredAuction {
  id: string;
  itemId: string;
  basePrice: number;
  bids: Bid[];
  endsAt: Date;
}

const ANA: UserSummary = { id: '7', name: 'Ana' };
const LUIS: UserSummary = { id: '9', name: 'Luis' };

// Las fechas se calculan al crear la instancia para que la demo no dependa de una fecha fija.
function seedAuctions(now: number): StoredAuction[] {
  return [
    {
      id: '12',
      itemId: MOCK_ITEM_IDS.watch,
      basePrice: 100000,
      bids: [
        { id: '54', amount: 110000, bidder: LUIS, createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString() },
        { id: '55', amount: 120000, bidder: ANA, createdAt: new Date(now - 60 * 60 * 1000).toISOString() },
      ],
      endsAt: new Date(now + 3 * DAY),
    },
    {
      id: '13',
      itemId: MOCK_ITEM_IDS.lamp,
      basePrice: 250000,
      bids: [],
      endsAt: new Date(now - DAY),
    },
  ];
}

export class MockAuctionClient implements AuctionClient {
  private readonly auctions: StoredAuction[] = seedAuctions(Date.now());

  async getAuctionsByItemIds(itemIds: string[]): Promise<Auction[]> {
    return this.auctions.filter((auction) => itemIds.includes(auction.itemId)).map(toAuction);
  }

  async getAuctionsByIds(ids: string[]): Promise<Auction[]> {
    return this.auctions.filter((auction) => ids.includes(auction.id)).map(toAuction);
  }
}

// Igual que el MS (rest.md §1): status se calcula al leer, y currentPrice es la puja más alta o el precio base.
function toAuction(stored: StoredAuction): Auction {
  const winningBid = stored.bids.reduce<Bid | null>(
    (best, bid) => (best === null || bid.amount > best.amount ? bid : best),
    null,
  );
  const participants = [...new Map(stored.bids.map((bid) => [bid.bidder.id, bid.bidder])).values()];
  return structuredClone({
    id: stored.id,
    itemId: stored.itemId,
    basePrice: stored.basePrice,
    currentPrice: winningBid?.amount ?? stored.basePrice,
    winningBid,
    participants,
    endsAt: stored.endsAt.toISOString(),
    status: Date.now() < stored.endsAt.getTime() ? 'OPEN' : 'CLOSED',
  });
}
