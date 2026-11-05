// Pruebas de publicar: el artículo nuevo aparece en el listado al volver, sin recargar la página.
import { GraphQLError } from 'graphql'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CREATE_ITEM, GET_ITEMS, type ItemDetail, type ItemSummary } from '../api/items'
import { mockItem, reloj } from '../test/datos'
import { ana, renderConApp } from '../test/render'

const nuevo = {
  __typename: 'Item',
  id: '2',
  name: 'Lámpara de bronce',
  description: null,
  category: null,
  images: [],
  documents: [],
  basePrice: 80000,
  auction: null,
} as unknown as ItemDetail

function llenarYEnviar() {
  fireEvent.change(screen.getByLabelText('Nombre del artículo'), { target: { value: 'Lámpara de bronce' } })
  fireEvent.change(screen.getByLabelText('Precio base de subasta ($ COP)'), { target: { value: '80000' } })
  fireEvent.click(screen.getByRole('button', { name: 'Publicar artículo' }))
}

describe('PublicarPage', () => {
  it('muestra el artículo nuevo en el listado al volver, sin recargar', async () => {
    renderConApp({
      conSesion: ana,
      mocks: [
        { request: { query: GET_ITEMS, variables: { search: null } }, result: { data: { items: [reloj] } } },
        {
          request: { query: CREATE_ITEM, variables: () => true },
          result: { data: { createItem: nuevo as unknown as ItemSummary } },
        },
        mockItem(nuevo, '2'),
        { request: { query: GET_ITEMS, variables: { search: null } }, result: { data: { items: [reloj, nuevo] } } },
      ],
    })

    await screen.findByRole('link', { name: 'Reloj antiguo' })
    fireEvent.click(await screen.findByRole('link', { name: 'Publicar artículo' }))
    llenarYEnviar()

    // Tras publicar va al detalle del artículo nuevo.
    expect(await screen.findByRole('heading', { name: 'Lámpara de bronce' })).toBeInTheDocument()

    // Al volver al listado se pide de nuevo y ya aparece.
    fireEvent.click(screen.getByRole('link', { name: 'Subastas' }))
    expect(await screen.findByRole('link', { name: 'Lámpara de bronce' })).toHaveAttribute('href', '/items/2')
    expect(screen.getByRole('link', { name: 'Reloj antiguo' })).toBeInTheDocument()
  })

  it('muestra el error del servidor y se queda en el formulario', async () => {
    renderConApp({
      ruta: '/publicar',
      conSesion: ana,
      mocks: [
        {
          request: { query: CREATE_ITEM, variables: () => true },
          result: { errors: [new GraphQLError('El precio base es muy bajo')] },
        },
      ],
    })

    await screen.findByRole('heading', { name: 'Publicar Artículo' })
    llenarYEnviar()

    expect(await screen.findByText('El precio base es muy bajo')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Publicar Artículo' })).toBeInTheDocument()
  })
})
