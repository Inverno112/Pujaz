// Pruebas del detalle: muestra los datos, el artículo inexistente y el error.
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GET_ITEM } from '../api/items'
import { mockItem, mockSuscripcion, reloj, subastaReloj } from '../test/datos'
import { renderConApp } from '../test/render'
import { DetallePage } from './DetallePage'

function renderDetalle(id: string, mocks: NonNullable<Parameters<typeof renderConApp>[0]>['mocks']) {
  renderConApp({ ruta: `/items/${id}`, mocks, pagina: <DetallePage />, patron: '/items/:id' })
}

describe('DetallePage', () => {
  it('muestra los datos del artículo y su subasta', async () => {
    renderDetalle('1', [mockItem(reloj), mockSuscripcion(subastaReloj)])

    expect(screen.getByText('Cargando artículo…')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Reloj antiguo' })).toBeInTheDocument()
    expect(screen.getByText('Reloj de bolsillo de 1920, funciona.')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Reloj antiguo, imagen 1' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Documento 1' })).toHaveAttribute(
      'href',
      'https://ejemplo.com/certificado.pdf',
    )
    expect(screen.getByRole('region', { name: 'Subasta' })).toHaveTextContent('Estado: Abierta')
  })

  it('avisa si el artículo no existe', async () => {
    renderDetalle('99', [mockItem(null, '99')])
    expect(await screen.findByRole('heading', { name: 'Artículo no encontrado' })).toBeInTheDocument()
  })

  it('muestra un error si el Gateway falla', async () => {
    renderDetalle('1', [
      { request: { query: GET_ITEM, variables: { id: '1' } }, error: new Error('Gateway caído') },
    ])
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar el artículo')
  })
})
