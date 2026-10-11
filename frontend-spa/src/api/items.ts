// Consultas GraphQL de artículos (contrato: items y item).
// Los tipos de TypeScript describen exactamente los campos que pedimos.
import { gql, type TypedDocumentNode } from '@apollo/client'

export type AuctionStatus = 'OPEN' | 'CLOSED'

export interface AuctionSummary {
  id: string
  currentPrice: number
  status: AuctionStatus
  endsAt: string
}

export interface ItemSummary {
  id: string
  name: string
  category: string | null
  images: string[]
  basePrice: number
  auction: AuctionSummary | null
}

// Quien puja: solo id y nombre (el contrato nunca expone el correo de otros usuarios).
export interface Bidder {
  id: string
  name: string
}

export interface Bid {
  id: string
  amount: number
  createdAt: string
  bidder: Bidder
}

export interface AuctionDetail extends AuctionSummary {
  winningBid: Bid | null
  participants: Bidder[]
}

export interface ItemDetail extends Omit<ItemSummary, 'auction'> {
  description: string | null
  documents: string[]
  auction: AuctionDetail | null
}

// Listado y búsqueda: search es opcional (null = todos los artículos).
export const GET_ITEMS: TypedDocumentNode<
  { items: ItemSummary[] },
  { search: string | null }
> = gql`
  query GetItems($search: String) {
    items(search: $search) {
      id
      name
      category
      images
      basePrice
      auction {
        id
        currentPrice
        status
        endsAt
      }
    }
  }
`

// Detalle de un artículo: item es null si no existe.
export const GET_ITEM: TypedDocumentNode<{ item: ItemDetail | null }, { id: string }> = gql`
  query GetItem($id: ID!) {
    item(id: $id) {
      id
      name
      description
      category
      images
      documents
      basePrice
      auction {
        id
        currentPrice
        status
        endsAt
        winningBid {
          id
          amount
          createdAt
          bidder {
            id
            name
          }
        }
        participants {
          id
          name
        }
      }
    }
  }
`

// Tiempo real: se emite cada vez que se acepta una puja en esa subasta.
// Apollo actualiza solo la subasta en la caché (por su id), y el detalle se vuelve a dibujar.
export const AUCTION_UPDATED: TypedDocumentNode<
  { auctionUpdated: AuctionDetail },
  { auctionId: string }
> = gql`
  subscription AuctionUpdated($auctionId: ID!) {
    auctionUpdated(auctionId: $auctionId) {
      id
      currentPrice
      status
      endsAt
      winningBid {
        id
        amount
        createdAt
        bidder {
          id
          name
        }
      }
      participants {
        id
        name
      }
    }
  }
`

// Pujar (requiere sesión). Errores: BID_TOO_LOW, INSUFFICIENT_FUNDS, AUCTION_CLOSED, NOT_FOUND.
export const PLACE_BID: TypedDocumentNode<
  { placeBid: Bid },
  { auctionId: string; amount: number }
> = gql`
  mutation PlaceBid($auctionId: ID!, $amount: Float!) {
    placeBid(auctionId: $auctionId, amount: $amount) {
      id
      amount
      createdAt
      bidder {
        id
        name
      }
    }
  }
`

// Lo que cambia en la subasta cuando la puja propia se acepta (se escribe directo en la caché).
export const SUBASTA_TRAS_PUJA: TypedDocumentNode<
  Pick<AuctionDetail, 'currentPrice' | 'winningBid'>
> = gql`
  fragment SubastaTrasPuja on Auction {
    currentPrice
    winningBid {
      id
      amount
      createdAt
      bidder {
        id
        name
      }
    }
  }
`
