// Pruebas del listado: muestra los datos, busca y muestra el error.
// MockedProvider reemplaza al Gateway con respuestas escritas aquí mismo.
import { MockedProvider } from '@apollo/client/testing/react'
import type { MockLink } from '@apollo/client/testing'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { GET_ITEMS, type ItemSummary } from '../api/items'
import { ListadoPage } from './ListadoPage'

const reloj: ItemSummary = {
  __typename: 'Item',
  id: '1',
  name: 'Reloj antiguo',
  category: 'Relojería',
  images: [],
  basePrice: 100000,
  auction: {
    __typename: 'Auction',
    id: 'a1',
    currentPrice: 150000,
    status: 'OPEN',
    endsAt: '2026-10-20T15:00:00Z',
  },
} as ItemSummary

const lampara: ItemSummary = {
  __typename: 'Item',
  id: '2',
  name: 'Lámpara de bronce',
  category: null,
  images: [],
  basePrice: 80000,
  auction: null,
} as ItemSummary

function renderListado(mocks: MockLink.MockedResponse[]) {
  render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter>
        <ListadoPage />
      </MemoryRouter>
    </MockedProvider>,
  )
}

describe('ListadoPage', () => {
  it('muestra los artículos con enlace a su detalle', async () => {
    renderListado([
      { request: { query: GET_ITEMS, variables: { search: null } }, result: { data: { items: [reloj, lampara] } } },
    ])

    expect(screen.getByText('Cargando artículos…')).toBeInTheDocument()
    const enlace = await screen.findByRole('link', { name: 'Reloj antiguo' })
    expect(enlace).toHaveAttribute('href', '/items/1')
    expect(screen.getByRole('link', { name: 'Lámpara de bronce' })).toBeInTheDocument()
    expect(screen.getByText('Subasta abierta')).toBeInTheDocument()
  })

  it('busca por el texto escrito', async () => {
    renderListado([
      { request: { query: GET_ITEMS, variables: { search: null } }, result: { data: { items: [reloj, lampara] } } },
      { request: { query: GET_ITEMS, variables: { search: 'reloj' } }, result: { data: { items: [reloj] } } },
    ])
    await screen.findByRole('link', { name: 'Lámpara de bronce' })

    fireEvent.change(screen.getByLabelText('Buscar artículos'), { target: { value: '  reloj ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))

    // Al terminar la búsqueda queda solo el reloj.
    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Lámpara de bronce' })).not.toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Reloj antiguo' })).toBeInTheDocument()
    })
  })

  it('avisa cuando la búsqueda no encuentra nada', async () => {
    renderListado([
      { request: { query: GET_ITEMS, variables: { search: null } }, result: { data: { items: [] } } },
    ])
    expect(await screen.findByText('Todavía no hay artículos en subasta.')).toBeInTheDocument()
  })

  it('muestra un error si el Gateway falla', async () => {
    renderListado([
      { request: { query: GET_ITEMS, variables: { search: null } }, error: new Error('Gateway caído') },
    ])
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar los artículos')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})
