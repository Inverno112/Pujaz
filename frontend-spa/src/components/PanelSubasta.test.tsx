// Pruebas del panel de subasta: tiempo real y formulario de puja con sus errores.
import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PLACE_BID, type AuctionDetail } from '../api/items'
import { DetallePage } from '../pages/DetallePage'
import { mockItem, mockSuscripcion, reloj, subastaReloj } from '../test/datos'
import { ana, renderConApp } from '../test/render'

type Mocks = NonNullable<Parameters<typeof renderConApp>[0]>['mocks']

function renderDetalle(mocks: Mocks, conSesion = false) {
  renderConApp({
    ruta: '/items/1',
    mocks,
    pagina: <DetallePage />,
    patron: '/items/:id',
    conSesion: conSesion ? ana : undefined,
  })
}

async function panel() {
  return within(await screen.findByRole('region', { name: 'Subasta' }))
}

function pujar(monto: string) {
  fireEvent.change(screen.getByLabelText('Tu oferta (COP)'), { target: { value: monto } })
  fireEvent.click(screen.getByRole('button', { name: 'Pujar' }))
}

function errorDePuja(monto: number, codigo: string) {
  return {
    request: { query: PLACE_BID, variables: { auctionId: 'a1', amount: monto } },
    result: { errors: [{ message: 'error', extensions: { code: codigo } }] },
  }
}

describe('PanelSubasta', () => {
  it('muestra precio actual, quién va ganando y los participantes', async () => {
    renderDetalle([mockItem(reloj), mockSuscripcion(subastaReloj)])
    const p = await panel()
    expect(p.getByText(/Precio actual/)).toHaveTextContent('$ 150.000')
    expect(p.getByText('Luis Pérez', { selector: 'strong' })).toBeInTheDocument()
    expect(p.getByRole('list', { name: 'Participantes' })).toHaveTextContent('Luis Pérez')
  })

  it('se actualiza en tiempo real cuando llega una puja nueva', async () => {
    const despuesDeLaPuja = {
      ...subastaReloj,
      currentPrice: 200000,
      winningBid: {
        ...subastaReloj.winningBid!,
        id: 'b2',
        amount: 200000,
        bidder: { __typename: 'Bidder', id: '12', name: 'Marta Ruiz' },
      },
      participants: [
        ...subastaReloj.participants,
        { __typename: 'Bidder', id: '12', name: 'Marta Ruiz' },
      ],
    } as unknown as AuctionDetail

    renderDetalle([mockItem(reloj), mockSuscripcion(despuesDeLaPuja, 30)])
    const p = await panel()
    expect(p.getByText('Luis Pérez', { selector: 'strong' })).toBeInTheDocument()

    expect(await p.findByText('Marta Ruiz', { selector: 'strong' })).toBeInTheDocument()
    expect(p.getByText(/Precio actual/)).toHaveTextContent('$ 200.000')
    expect(p.getByRole('list', { name: 'Participantes' })).toHaveTextContent('Marta Ruiz')
  })

  it('sin sesión invita a iniciar sesión para pujar', async () => {
    renderDetalle([mockItem(reloj), mockSuscripcion(subastaReloj)])
    const p = await panel()
    expect(p.getByRole('link', { name: 'Inicia sesión para pujar' })).toHaveAttribute('href', '/login')
    expect(p.queryByRole('button', { name: 'Pujar' })).not.toBeInTheDocument()
  })

  it('con sesión registra la puja y actualiza el precio', async () => {
    renderDetalle(
      [
        mockItem(reloj),
        mockSuscripcion(subastaReloj),
        {
          request: { query: PLACE_BID, variables: { auctionId: 'a1', amount: 180000 } },
          result: {
            data: {
              placeBid: {
                __typename: 'Bid',
                id: 'b9',
                amount: 180000,
                createdAt: '2026-10-10T16:00:00Z',
                bidder: { __typename: 'Bidder', id: ana.id, name: ana.name },
              },
            },
          },
        },
      ],
      true,
    )
    const p = await panel()
    await p.findByRole('button', { name: 'Pujar' })
    pujar('180000')

    expect(await p.findByRole('status')).toHaveTextContent('Tu puja de $ 180.000 quedó registrada.')
    expect(p.getByText('Vas ganando esta subasta.')).toBeInTheDocument()
    expect(p.getByText(/Precio actual/)).toHaveTextContent('$ 180.000')
  })

  it.each([
    ['BID_TOO_LOW', 'Tu oferta debe superar el precio actual.'],
    ['INSUFFICIENT_FUNDS', 'No tienes saldo disponible suficiente.'],
    ['AUCTION_CLOSED', 'Esta subasta ya terminó.'],
  ])('muestra el error %s', async (codigo, mensaje) => {
    renderDetalle([mockItem(reloj), mockSuscripcion(subastaReloj), errorDePuja(160000, codigo)], true)
    const p = await panel()
    await p.findByRole('button', { name: 'Pujar' })
    pujar('160000')
    expect(await p.findByRole('alert')).toHaveTextContent(mensaje)
  })

  it('si la subasta está cerrada no deja pujar', async () => {
    const cerrada = { ...subastaReloj, status: 'CLOSED' } as unknown as AuctionDetail
    renderDetalle([mockItem({ ...reloj, auction: cerrada }), mockSuscripcion(cerrada)], true)
    const p = await panel()
    expect(await p.findByText('Esta subasta ya terminó: no recibe más pujas.')).toBeInTheDocument()
    expect(p.queryByRole('button', { name: 'Pujar' })).not.toBeInTheDocument()
  })
})
