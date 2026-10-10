// Pruebas del perfil: muestra los datos, los edita y elimina la cuenta.
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GET_ITEMS } from '../api/items'
import { DELETE_USER, UPDATE_USER } from '../api/usuarios'
import { ana, renderConApp } from '../test/render'

describe('PerfilPage', () => {
  it('muestra los datos del usuario', async () => {
    renderConApp({ ruta: '/perfil', conSesion: ana })
    expect(await screen.findByRole('heading', { name: 'Mi perfil' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre')).toHaveValue('Ana Gómez')
    expect(screen.getByLabelText('Correo')).toHaveValue('ana@correo.com')
  })

  it('guarda solo lo que cambió', async () => {
    renderConApp({
      ruta: '/perfil',
      conSesion: ana,
      mocks: [
        {
          request: { query: UPDATE_USER, variables: { input: { name: 'Ana María Gómez' } } },
          result: { data: { updateUser: { ...ana, name: 'Ana María Gómez' } } },
        },
      ],
    })
    fireEvent.change(await screen.findByLabelText('Nombre'), { target: { value: 'Ana María Gómez' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Tus datos quedaron guardados.')
    expect(await screen.findByText('Hola, Ana María Gómez')).toBeInTheDocument()
  })

  it('avisa si el correo nuevo ya lo usa otra cuenta', async () => {
    renderConApp({
      ruta: '/perfil',
      conSesion: ana,
      mocks: [
        {
          request: { query: UPDATE_USER, variables: { input: { email: 'luis@correo.com' } } },
          result: { errors: [{ message: 'Correo en uso', extensions: { code: 'EMAIL_TAKEN' } }] },
        },
      ],
    })
    fireEvent.change(await screen.findByLabelText('Correo'), { target: { value: 'luis@correo.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe otra cuenta con ese correo.')
  })

  it('elimina la cuenta después de confirmar y cierra la sesión', async () => {
    renderConApp({
      ruta: '/perfil',
      conSesion: ana,
      mocks: [
        { request: { query: DELETE_USER }, result: { data: { deleteUser: true } } },
        { request: { query: GET_ITEMS, variables: { search: null } }, result: { data: { items: [] } } },
      ],
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar mi cuenta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, eliminar mi cuenta' }))

    expect(await screen.findByRole('heading', { name: 'Subastas' })).toBeInTheDocument()
    // La sesión se cierra en una transición: se espera a que el menú cambie.
    expect(await screen.findByRole('link', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(localStorage.getItem('pujaz_token')).toBeNull()
  })
})
