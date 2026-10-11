// Contrato con el MS transaccional para subastas (rest.md §1.3).

export type AuctionStatus = 'OPEN' | 'CLOSED';

// Lo que se ve de otros usuarios (rest.md §1).
export interface UserSummary {
  id: string;
  name: string;
}

export interface Bid {
  id: string;
  amount: number;
  bidder: UserSummary;
  createdAt: string;
}

export interface Auction {
  id: string;
  itemId: string;
  basePrice: number;
  currentPrice: number;
  winningBid: Bid | null;
  participants: UserSummary[];
  endsAt: string;
  status: AuctionStatus;
}

// Cuerpo de POST /auctions (rest.md §1.3).
export interface NewAuction {
  itemId: string;
  basePrice: number;
  endsAt: string;
}

// Respuesta de POST /auctions/{auctionId}/bids (rest.md §1.3).
export interface PlacedBid {
  bid: Bid;
  auction: Auction;
}

export interface AuctionClient {
  /** GET /auctions?itemIds= · los ítems sin subasta no aparecen; nunca 404 */
  getAuctionsByItemIds(itemIds: string[]): Promise<Auction[]>;
  /** GET /auctions?ids= · los ids que no existen no aparecen; nunca 404 */
  getAuctionsByIds(ids: string[]): Promise<Auction[]>;
  /** POST /auctions · Errores: BAD_USER_INPUT (endsAt en el pasado, basePrice <= 0 o ya existe para ese ítem) */
  createAuction(input: NewAuction): Promise<Auction>;
  /** POST /auctions/{auctionId}/bids · Errores: NOT_FOUND, AUCTION_CLOSED, BID_TOO_LOW, INSUFFICIENT_FUNDS */
  placeBid(auctionId: string, userId: string, amount: number): Promise<PlacedBid>;
}
