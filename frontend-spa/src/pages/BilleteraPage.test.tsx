// Pruebas de la billetera: saldos, movimientos, recarga y error.
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DEPOSIT, WALLET, type Billetera } from '../api/billetera'
import { ana, renderConApp } from '../test/render'

const billetera = {
  __typename: 'Wallet',
  userId: '7',
  available: 380000,
  reserved: 120000,
  movements: [
    {
      __typename: 'WalletMovement',
      id: '301',
      type: 'RESERVE',
      amount: 120000,
      createdAt: '2026-10-10T14:00:00Z',
      auction: {
        __typename: 'Auction',
        id: 'a1',
        item: { __typename: 'Item', id: '1', name: 'Reloj antiguo' },
      },
    },
    {
      __typename: 'WalletMovement',
      id: '300',
      type: 'DEPOSIT',
      amount: 500000,
      createdAt: '2026-10-10T12:00:00Z',
      auction: null,
    },
  ],
} as unknown as Billetera

const pedirBilletera = { request: { query: WALLET }, result: { data: { wallet: billetera } } }

describe('BilleteraPage', () => {
  it('muestra los saldos y los movimientos', async () => {
    renderConApp({ ruta: '/billetera', conSesion: ana, mocks: [pedirBilletera] })

    expect(await screen.findByLabelText('Saldo disponible')).toHaveTextContent('$ 380.000')
    expect(screen.getByLabelText('Saldo reservado')).toHaveTextContent('$ 120.000')
    expect(screen.getByText('Reserva por puja')).toBeInTheDocument()
    expect(screen.getByText('Recarga')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Reloj antiguo' })).toHaveAttribute('href', '/items/1')
  })

  it('recarga y actualiza el saldo disponible', async () => {
    const despues = {
      ...billetera,
      available: 430000,
      movements: [
        {
          __typename: 'WalletMovement',
          id: '1000',
          type: 'DEPOSIT',
          amount: 50000,
          createdAt: '2026-10-10T16:00:00Z',
          auction: null,
        },
        ...billetera.movements,
      ],
    }
    renderConApp({
      ruta: '/billetera',
      conSesion: ana,
      mocks: [
        pedirBilletera,
        { request: { query: DEPOSIT, variables: { amount: 50000 } }, result: { data: { deposit: despues } } },
      ],
    })

    fireEvent.change(await screen.findByLabelText('Monto a recargar (COP)'), { target: { value: '50000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Recargar' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Recargaste $ 50.000.')
    expect(screen.getByLabelText('Saldo disponible')).toHaveTextContent('$ 430.000')
  })

  it('muestra un error si no se puede cargar', async () => {
    renderConApp({
      ruta: '/billetera',
      conSesion: ana,
      mocks: [{ request: { query: WALLET }, error: new Error('Gateway caído') }],
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar tu billetera')
  })
})
