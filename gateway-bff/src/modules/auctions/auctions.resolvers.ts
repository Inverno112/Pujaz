import type { GatewayContext } from '../../core/context.js';
import { AppError } from '../../core/errors.js';
import type { Item } from '../catalog/index.js';
import type { WalletMovement } from '../wallet/index.js';
import type { Auction } from './auction.client.js';
import type { AuctionLoaders, AuctionsService } from './auctions.service.js';

export function createAuctionsResolvers(auctionsService: AuctionsService) {
  // El contexto es un objeto nuevo en cada petición: así los cargadores no se comparten entre peticiones.
  const loadersByRequest = new WeakMap<GatewayContext, AuctionLoaders>();

  function loaders(ctx: GatewayContext): AuctionLoaders {
    let current = loadersByRequest.get(ctx);
    if (!current) {
      current = auctionsService.createLoaders();
      loadersByRequest.set(ctx, current);
    }
    return current;
  }

  return {
    Query: {
      auction: (_parent: unknown, args: { itemId: string }, ctx: GatewayContext) =>
        loaders(ctx).auctionByItemId.load(args.itemId),
    },
    Item: {
      auction: (item: Item, _args: unknown, ctx: GatewayContext) => loaders(ctx).auctionByItemId.load(item.id),
    },
    Auction: {
      item: async (auction: Auction, _args: unknown, ctx: GatewayContext) => {
        const item = await loaders(ctx).item.load(auction.itemId);
        if (!item) {
          throw new AppError('NOT_FOUND', 'El ítem de la subasta no existe.');
        }
        return item;
      },
    },
    WalletMovement: {
      // Las recargas no tienen subasta.
      auction: (movement: WalletMovement, _args: unknown, ctx: GatewayContext) =>
        movement.auctionId === null ? null : loaders(ctx).auctionById.load(movement.auctionId),
    },
  };
}
