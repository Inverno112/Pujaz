import { createPubSub } from 'graphql-yoga';
import type { Auction } from '../modules/auctions/index.js';

// Eventos en vivo, en memoria del proceso. Funciona porque el prototipo corre una sola copia del
// Gateway: con varias copias, un suscriptor no vería las pujas hechas en otra.
export type GatewayPubSub = ReturnType<typeof createGatewayPubSub>;

export function createGatewayPubSub() {
  return createPubSub<{
    // Tema por subasta: solo reciben el evento quienes siguen esa subasta.
    auctionUpdated: [auctionId: string, auction: Auction];
  }>();
}
