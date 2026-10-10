import { AppError } from '../../../core/errors.js';
import type { Wallet, WalletClient } from '../../../modules/wallet/index.js';

const HOUR = 60 * 60 * 1000;

// Coherente con la subasta 12 de auction.mock.ts: Luis pujó 110000, Ana lo superó con 120000
// y a Luis se le devolvió su monto. La billetera de Ana es el ejemplo de rest.md §1.2.
function seedWallets(now: number): Wallet[] {
  const at = (hoursAgo: number) => new Date(now - hoursAgo * HOUR).toISOString();
  return [
    {
      userId: '7',
      available: 380000,
      reserved: 120000,
      movements: [
        { id: '301', type: 'RESERVE', amount: 120000, auctionId: '12', createdAt: at(1) },
        { id: '300', type: 'DEPOSIT', amount: 500000, auctionId: null, createdAt: at(3) },
      ],
    },
    {
      userId: '9',
      available: 300000,
      reserved: 0,
      movements: [
        { id: '304', type: 'REFUND', amount: 110000, auctionId: '12', createdAt: at(1) },
        { id: '303', type: 'RESERVE', amount: 110000, auctionId: '12', createdAt: at(2) },
        { id: '302', type: 'DEPOSIT', amount: 300000, auctionId: null, createdAt: at(4) },
      ],
    },
  ];
}

export class MockWalletClient implements WalletClient {
  private readonly wallets: Wallet[] = seedWallets(Date.now());
  private nextMovementId = 1000;

  async getWallet(userId: string): Promise<Wallet> {
    return structuredClone(this.findOrCreate(userId));
  }

  async deposit(userId: string, amount: number): Promise<Wallet> {
    if (!(amount > 0)) {
      throw new AppError('BAD_USER_INPUT', 'El monto de la recarga debe ser mayor que cero.');
    }
    const wallet = this.findOrCreate(userId);
    wallet.available += amount;
    wallet.movements.unshift({
      id: String(this.nextMovementId++),
      type: 'DEPOSIT',
      amount,
      auctionId: null,
      createdAt: new Date().toISOString(),
    });
    return structuredClone(wallet);
  }

  // En el MS cada usuario tiene billetera desde que se crea. El cliente falso no comparte datos
  // con MockUserClient, así que un usuario sin billetera guardada (uno recién registrado) recibe
  // una vacía en vez de NOT_FOUND.
  private findOrCreate(userId: string): Wallet {
    let wallet = this.wallets.find((candidate) => candidate.userId === userId);
    if (!wallet) {
      wallet = { userId, available: 0, reserved: 0, movements: [] };
      this.wallets.push(wallet);
    }
    return wallet;
  }
}
