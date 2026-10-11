import type { Wallet, WalletClient } from '../../../modules/wallet/index.js';
import { parseWallet } from '../../http/contract.js';
import type { HttpClient } from '../../http/http-client.js';

// MS transaccional, rest.md §1.2.
export class HttpWalletClient implements WalletClient {
  constructor(private readonly http: HttpClient) {}

  getWallet(userId: string): Promise<Wallet> {
    return this.http.get(`/users/${encodeURIComponent(userId)}/wallet`, parseWallet);
  }

  deposit(userId: string, amount: number, promoCode: string): Promise<Wallet> {
    return this.http.post(`/users/${encodeURIComponent(userId)}/wallet/deposits`, { amount, promoCode }, parseWallet);
  }
}
