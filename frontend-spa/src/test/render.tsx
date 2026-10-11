// Ayudas para las pruebas: monta la app (o una página) con un Gateway simulado y la sesión.
import type { MockLink } from '@apollo/client/testing'
import { MockedProvider } from '@apollo/client/testing/react'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ME, type Usuario } from '../api/usuarios'
import { App } from '../App'
import { SessionProvider } from '../session/SessionProvider'

export const ana: Usuario = {
  __typename: 'User',
  id: '7',
  name: 'Ana Gómez',
  email: 'ana@correo.com',
  createdAt: '2026-10-01T12:00:00Z',
} as unknown as Usuario

// Respuesta de `me` para simular una sesión iniciada.
export function mockMe(usuario: Usuario = ana): MockLink.MockedResponse {
  return { request: { query: ME }, result: { data: { me: usuario } } }
}

interface Opciones {
  ruta?: string
  mocks?: MockLink.MockedResponse[]
  // Si se pasa, se guarda un token y se agrega el mock de `me` con este usuario.
  conSesion?: Usuario
  // Monta solo esta página en `patron` (por ejemplo /items/:id) en vez de toda la app.
  pagina?: ReactNode
  patron?: string
}

export function renderConApp({ ruta = '/', mocks = [], conSesion, pagina, patron = '*' }: Opciones = {}) {
  localStorage.clear()
  const todos = [...mocks]
  if (conSesion) {
    localStorage.setItem('pujaz_token', 'token-de-prueba')
    todos.unshift(mockMe(conSesion))
  }
  // useTransitions={false}: en las pruebas la navegación se aplica de inmediato
  // (con transiciones, jsdom no siempre alcanza a mostrar la página nueva).
  return render(
    <MockedProvider mocks={todos}>
      <SessionProvider>
        <MemoryRouter initialEntries={[ruta]} useTransitions={false}>
          {pagina ? (
            <Routes>
              <Route path={patron} element={pagina} />
              <Route path="/login" element={<h1>Iniciar sesión</h1>} />
            </Routes>
          ) : (
            <App />
          )}
        </MemoryRouter>
      </SessionProvider>
    </MockedProvider>,
  )
}
