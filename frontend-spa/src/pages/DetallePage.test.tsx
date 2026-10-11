// Pruebas del detalle: muestra los datos, el artículo inexistente y el error.
import { fireEvent, screen } from '@testing-library/react'
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

  it('muestra varias perspectivas y cambia de foto al elegir una miniatura', async () => {
    const conFotos = {
      ...reloj,
      images: ['https://ejemplo.com/frente.jpg', 'https://ejemplo.com/maquina.jpg', 'https://ejemplo.com/tapa.jpg'],
    }
    renderDetalle('1', [mockItem(conFotos), mockSuscripcion(subastaReloj)])

    expect(await screen.findByRole('img', { name: 'Reloj antiguo, imagen 1' })).toHaveAttribute(
      'src',
      'https://ejemplo.com/frente.jpg',
    )
    expect(screen.getAllByRole('button', { name: /Ver imagen/ })).toHaveLength(3)

    fireEvent.click(screen.getByRole('button', { name: 'Ver imagen 2' }))

    expect(screen.getByRole('img', { name: 'Reloj antiguo, imagen 2' })).toHaveAttribute(
      'src',
      'https://ejemplo.com/maquina.jpg',
    )
    expect(screen.getByRole('button', { name: 'Ver imagen 2' })).toHaveAttribute('aria-pressed', 'true')
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
