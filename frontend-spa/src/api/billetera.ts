// Operaciones GraphQL de la billetera (contrato: wallet, deposit). Requieren sesión.
import { gql, type TypedDocumentNode } from '@apollo/client'

export type TipoMovimiento = 'DEPOSIT' | 'RESERVE' | 'REFUND'

export interface Movimiento {
  id: string
  type: TipoMovimiento
  amount: number
  createdAt: string
  auction: { id: string; item: { id: string; name: string } } | null
}

export interface Billetera {
  userId: string
  available: number
  reserved: number
  movements: Movimiento[]
}

export const WALLET: TypedDocumentNode<{ wallet: Billetera }, Record<string, never>> = gql`
  query Wallet {
    wallet {
      userId
      available
      reserved
      movements {
        id
        type
        amount
        createdAt
        auction {
          id
          item {
            id
            name
          }
        }
      }
    }
  }
`

export const DEPOSIT: TypedDocumentNode<{ deposit: Billetera }, { amount: number }> = gql`
  mutation Deposit($amount: Float!) {
    deposit(amount: $amount) {
      userId
      available
      reserved
      movements {
        id
        type
        amount
        createdAt
        auction {
          id
          item {
            id
            name
          }
        }
      }
    }
  }
`
