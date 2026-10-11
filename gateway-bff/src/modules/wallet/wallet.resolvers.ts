import { requireUser, type GatewayContext } from '../../core/context.js';
import type { WalletService } from './wallet.service.js';

export function createWalletResolvers(walletService: WalletService) {
  return {
    Query: {
      wallet: (_parent: unknown, _args: unknown, ctx: GatewayContext) => walletService.getWallet(requireUser(ctx)),
    },
    Mutation: {
      deposit: (_parent: unknown, args: { amount: number; promoCode: string }, ctx: GatewayContext) =>
        walletService.deposit(requireUser(ctx), args.amount, args.promoCode),
    },
  };
}
