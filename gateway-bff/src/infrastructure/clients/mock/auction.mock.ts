import { AppError } from '../../../core/errors.js';
import type { Auction, AuctionClient, Bid, NewAuction, PlacedBid, UserSummary } from '../../../modules/auctions/index.js';
import type { UserClient } from '../../../modules/users/index.js';
import { MOCK_ITEM_IDS } from './item.mock.js';
import type { MockWalletClient } from './wallet.mock.js';

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
  private nextId = 100;
  private nextBidId = 1000;

  // Al pujar se mueve la billetera (reserva y reintegro) y el nombre de quien puja sale de los
  // usuarios, igual que en el MS. Sin estas dependencias, el cliente solo sirve para lecturas.
  constructor(
    private readonly deps: { wallet?: MockWalletClient; users?: UserClient } = {},
  ) {}

  async getAuctionsByItemIds(itemIds: string[]): Promise<Auction[]> {
    return this.auctions.filter((auction) => itemIds.includes(auction.itemId)).map(toAuction);
  }

  async getAuctionsByIds(ids: string[]): Promise<Auction[]> {
    return this.auctions.filter((auction) => ids.includes(auction.id)).map(toAuction);
  }

  // Mismo orden que el MS (rest.md §1.3).
  async placeBid(auctionId: string, userId: string, amount: number): Promise<PlacedBid> {
    const { wallet, users } = this.deps;
    if (!wallet || !users) {
      throw new Error('MockAuctionClient necesita la billetera y los usuarios para pujar.');
    }
    const stored = this.auctions.find((auction) => auction.id === auctionId);
    if (!stored) {
      throw new AppError('NOT_FOUND', 'La subasta no existe.');
    }
    const current = toAuction(stored);
    if (current.status === 'CLOSED') {
      throw new AppError('AUCTION_CLOSED', 'La subasta ya terminó.');
    }
    if (amount <= current.currentPrice) {
      throw new AppError('BID_TOO_LOW', `La puja debe superar el precio actual (${current.currentPrice}).`);
    }
    const previous = current.winningBid;
    const alreadyReserved = previous?.bidder.id === userId ? previous.amount : 0;
    if (wallet.available(userId) + alreadyReserved < amount) {
      throw new AppError('INSUFFICIENT_FUNDS', 'No tienes saldo disponible suficiente.');
    }
    const user = await users.getUser(userId);

    wallet.reserve(userId, auctionId, amount);
    if (previous) {
      wallet.refund(previous.bidder.id, auctionId, previous.amount);
    }
    const bid: Bid = {
      id: String(this.nextBidId++),
      amount,
      bidder: { id: user.id, name: user.name },
      createdAt: new Date().toISOString(),
    };
    stored.bids.push(bid);
    return { bid: structuredClone(bid), auction: toAuction(stored) };
  }

  // Mismas reglas que el MS (rest.md §1.3).
  async createAuction(input: NewAuction): Promise<Auction> {
    const endsAt = new Date(input.endsAt);
    if (Number.isNaN(endsAt.getTime()) || endsAt.getTime() <= Date.now()) {
      throw new AppError('BAD_USER_INPUT', 'La fecha de cierre debe estar en el futuro.');
    }
    if (!(input.basePrice > 0)) {
      throw new AppError('BAD_USER_INPUT', 'El precio base debe ser mayor que cero.');
    }
    if (this.auctions.some((auction) => auction.itemId === input.itemId)) {
      throw new AppError('BAD_USER_INPUT', 'Ese ítem ya tiene una subasta.');
    }
    const stored: StoredAuction = {
      id: String(this.nextId++),
      itemId: input.itemId,
      basePrice: input.basePrice,
      bids: [],
      endsAt,
    };
    this.auctions.push(stored);
    return toAuction(stored);
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
