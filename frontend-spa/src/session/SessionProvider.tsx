// Guarda la sesión: el JWT queda en localStorage y el usuario se pide con `me`.
import { useApolloClient, useQuery } from '@apollo/client/react'
import { startTransition, useCallback, useMemo, useState, type ReactNode } from 'react'
import { clearToken, getToken, saveToken } from '../api/auth'
import { codigoError } from '../api/errores'
import { ME, type AuthPayload } from '../api/usuarios'
import { SessionContext, type Sesion } from './SessionContext'

export function SessionProvider({ children }: { children: ReactNode }) {
  const client = useApolloClient()
  const [token, setToken] = useState<string | null>(() => getToken())

  // Solo se pregunta `me` si hay un token guardado.
  const { data, loading, error } = useQuery(ME, { skip: !token })

  // Si el token venció o no es válido, se trata como sesión cerrada.
  const tokenInvalido = codigoError(error) === 'UNAUTHENTICATED'
  const usuario = token && !tokenInvalido ? (data?.me ?? null) : null

  const iniciarSesion = useCallback(
    ({ token: nuevoToken, user }: AuthPayload) => {
      saveToken(nuevoToken)
      // Se guarda el usuario en la caché para no volver a pedirlo.
      client.writeQuery({ query: ME, data: { me: user } })
      setToken(nuevoToken)
    },
    [client],
  )

  const cerrarSesion = useCallback(() => {
    clearToken()
    // En transición, igual que la navegación del enrutador: si quien llama también navega,
    // ambos cambios se aplican juntos y las páginas privadas no alcanzan a redirigir a /login.
    startTransition(() => setToken(null))
    // Borra de la caché los datos privados (billetera, perfil).
    void client.clearStore()
  }, [client])

  const sesion = useMemo<Sesion>(
    () => ({ usuario, cargando: Boolean(token) && loading, iniciarSesion, cerrarSesion }),
    [usuario, token, loading, iniciarSesion, cerrarSesion],
  )

  return <SessionContext.Provider value={sesion}>{children}</SessionContext.Provider>
}
