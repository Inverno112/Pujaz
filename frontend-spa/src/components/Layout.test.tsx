// Menú y rutas: cambia según haya sesión o no, y las páginas privadas piden iniciar sesión.
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GET_ITEMS } from '../api/items'
import { ana, renderConApp } from '../test/render'

const listadoVacio = {
  request: { query: GET_ITEMS, variables: { search: null } },
  result: { data: { items: [] } },
}

describe('Layout', () => {
  it('sin sesión muestra el menú con "Iniciar sesión"', async () => {
    renderConApp({ mocks: [listadoVacio] })
    const menu = screen.getByRole('navigation', { name: 'Menú principal' })
    expect(menu).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Mi billetera' })).not.toBeInTheDocument()
    expect(await screen.findByText('Todavía no hay artículos en subasta.')).toBeInTheDocument()
  })

  it('con sesión muestra el nombre, la billetera y permite cerrar sesión', async () => {
    renderConApp({ mocks: [listadoVacio], conSesion: ana })
    expect(await screen.findByText('Hola, Ana Gómez')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mi billetera' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(await screen.findByRole('link', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(localStorage.getItem('pujaz_token')).toBeNull()
  })

  it('una página privada sin sesión manda a iniciar sesión', async () => {
    renderConApp({ ruta: '/billetera' })
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
  })
})
