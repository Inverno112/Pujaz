import type { Wallet, WalletClient } from './wallet.client.js';

export class WalletService {
  constructor(private readonly walletClient: WalletClient) {}

  getWallet(userId: string): Promise<Wallet> {
    return this.walletClient.getWallet(userId);
  }

  // El MS valida que amount sea positivo (BAD_USER_INPUT); el Gateway no repite la regla.
  deposit(userId: string, amount: number): Promise<Wallet> {
    return this.walletClient.deposit(userId, amount);
  }
}
