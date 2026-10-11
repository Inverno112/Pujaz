// Contrato con el MS transaccional para la billetera (rest.md §1.2).

export type MovementType = 'DEPOSIT' | 'RESERVE' | 'REFUND';

export interface WalletMovement {
  id: string;
  type: MovementType;
  amount: number;
  // null en las recargas (DEPOSIT).
  auctionId: string | null;
  createdAt: string;
}

export interface Wallet {
  userId: string;
  available: number;
  reserved: number;
  // Del más reciente al más antiguo.
  movements: WalletMovement[];
}

export interface WalletClient {
  /** GET /users/{userId}/wallet · Errores: NOT_FOUND */
  getWallet(userId: string): Promise<Wallet>;
  /** POST /users/{userId}/wallet/deposits · Errores: BAD_USER_INPUT (amount <= 0), NOT_FOUND */
  deposit(userId: string, amount: number): Promise<Wallet>;
}
