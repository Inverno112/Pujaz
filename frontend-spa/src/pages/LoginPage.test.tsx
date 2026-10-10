// Pruebas del inicio de sesión: entra y guarda el token, o muestra el error.
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GET_ITEMS } from '../api/items'
import { LOGIN } from '../api/usuarios'
import { ana, renderConApp } from '../test/render'

function llenarYEnviar(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Correo'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
}

describe('LoginPage', () => {
  it('inicia sesión, guarda el token y vuelve a las subastas', async () => {
    renderConApp({
      ruta: '/login',
      mocks: [
        {
          request: { query: LOGIN, variables: { email: 'ana@correo.com', password: 'secreto123' } },
          result: { data: { login: { __typename: 'AuthPayload', token: 'jwt-nuevo', user: ana } } },
        },
        { request: { query: GET_ITEMS, variables: { search: null } }, result: { data: { items: [] } } },
      ],
    })

    llenarYEnviar('ana@correo.com', 'secreto123')

    expect(await screen.findByText('Hola, Ana Gómez')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Subastas' })).toBeInTheDocument()
    expect(localStorage.getItem('pujaz_token')).toBe('jwt-nuevo')
  })

  it('muestra un mensaje si el correo o la contraseña están mal', async () => {
    renderConApp({
      ruta: '/login',
      mocks: [
        {
          request: { query: LOGIN, variables: { email: 'ana@correo.com', password: 'malamala' } },
          result: {
            errors: [{ message: 'Credenciales inválidas', extensions: { code: 'INVALID_CREDENTIALS' } }],
          },
        },
      ],
    })

    llenarYEnviar('ana@correo.com', 'malamala')

    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos.')
    expect(localStorage.getItem('pujaz_token')).toBeNull()
  })
})
