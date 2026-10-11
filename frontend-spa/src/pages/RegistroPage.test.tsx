// Pruebas del registro: crea la cuenta e inicia sesión, o muestra el error.
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GET_ITEMS } from '../api/items'
import { REGISTER } from '../api/usuarios'
import { ana, renderConApp } from '../test/render'

function llenarYEnviar(password = 'secreto123') {
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana Gómez' } })
  fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'ana@correo.com' } })
  fireEvent.change(screen.getByLabelText('Contraseña (mínimo 8 caracteres)'), {
    target: { value: password },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
}

const pedido = {
  query: REGISTER,
  variables: { input: { name: 'Ana Gómez', email: 'ana@correo.com', password: 'secreto123' } },
}

describe('RegistroPage', () => {
  it('crea la cuenta, inicia sesión y va a las subastas', async () => {
    renderConApp({
      ruta: '/registro',
      mocks: [
        {
          request: pedido,
          result: { data: { register: { __typename: 'AuthPayload', token: 'jwt-ana', user: ana } } },
        },
        { request: { query: GET_ITEMS, variables: { search: null } }, result: { data: { items: [] } } },
      ],
    })
    llenarYEnviar()
    expect(await screen.findByText('Hola, Ana Gómez')).toBeInTheDocument()
    expect(localStorage.getItem('pujaz_token')).toBe('jwt-ana')
  })

  it('avisa si el correo ya está registrado', async () => {
    renderConApp({
      ruta: '/registro',
      mocks: [
        {
          request: pedido,
          result: { errors: [{ message: 'Correo en uso', extensions: { code: 'EMAIL_TAKEN' } }] },
        },
      ],
    })
    llenarYEnviar()
    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe una cuenta con ese correo.')
  })

  it('no envía una contraseña de menos de 8 caracteres', async () => {
    renderConApp({ ruta: '/registro' })
    llenarYEnviar('corta')
    expect(await screen.findByRole('alert')).toHaveTextContent('al menos 8 caracteres')
  })
})
