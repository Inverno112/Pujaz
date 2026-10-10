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

export interface AuctionClient {
  /** GET /auctions?itemIds= · los ítems sin subasta no aparecen; nunca 404 */
  getAuctionsByItemIds(itemIds: string[]): Promise<Auction[]>;
  /** GET /auctions?ids= · los ids que no existen no aparecen; nunca 404 */
  getAuctionsByIds(ids: string[]): Promise<Auction[]>;
}
