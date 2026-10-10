// Sesión del usuario: quién inició sesión y cómo entrar o salir.
// El proveedor está en SessionProvider.tsx; aquí solo el contexto y el hook para leerlo.
import { createContext, useContext } from 'react'
import type { AuthPayload, Usuario } from '../api/usuarios'

export interface Sesion {
  usuario: Usuario | null
  // true mientras se confirma con el Gateway el token guardado.
  cargando: boolean
  iniciarSesion: (datos: AuthPayload) => void
  cerrarSesion: () => void
}

export const SessionContext = createContext<Sesion | null>(null)

export function useSesion(): Sesion {
  const sesion = useContext(SessionContext)
  if (!sesion) {
    throw new Error('useSesion debe usarse dentro de <SessionProvider>.')
  }
  return sesion
}
