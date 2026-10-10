// Datos de ejemplo para las pruebas, con la forma del contrato.
import type { MockLink } from '@apollo/client/testing'
import { AUCTION_UPDATED, GET_ITEM, type AuctionDetail, type ItemDetail } from '../api/items'

export const subastaReloj = {
  __typename: 'Auction',
  id: 'a1',
  currentPrice: 150000,
  status: 'OPEN',
  endsAt: '2026-10-20T15:00:00Z',
  winningBid: {
    __typename: 'Bid',
    id: 'b1',
    amount: 150000,
    createdAt: '2026-10-09T15:00:00Z',
    bidder: { __typename: 'Bidder', id: '9', name: 'Luis Pérez' },
  },
  participants: [{ __typename: 'Bidder', id: '9', name: 'Luis Pérez' }],
} as unknown as AuctionDetail

export const reloj = {
  __typename: 'Item',
  id: '1',
  name: 'Reloj antiguo',
  description: 'Reloj de bolsillo de 1920, funciona.',
  category: 'Relojería',
  images: ['https://ejemplo.com/reloj.jpg'],
  documents: ['https://ejemplo.com/certificado.pdf'],
  basePrice: 100000,
  auction: subastaReloj,
} as unknown as ItemDetail

export function mockItem(item: ItemDetail | null, id = '1'): MockLink.MockedResponse {
  return { request: { query: GET_ITEM, variables: { id } }, result: { data: { item } } }
}

// La suscripción: `delay` en milisegundos simula que la puja de otra persona llega después.
export function mockSuscripcion(subasta: AuctionDetail, delay = 0): MockLink.MockedResponse {
  return {
    request: { query: AUCTION_UPDATED, variables: { auctionId: subasta.id } },
    result: { data: { auctionUpdated: subasta } },
    delay,
  }
}
