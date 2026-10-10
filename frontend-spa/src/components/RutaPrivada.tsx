// Protege las páginas que exigen sesión: sin sesión, manda a /login y luego regresa.
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSesion } from '../session/SessionContext'

export function RutaPrivada() {
  const { usuario, cargando } = useSesion()
  const location = useLocation()

  if (cargando) return <p>Cargando…</p>
  if (!usuario) {
    return <Navigate to="/login" replace state={{ desde: location.pathname }} />
  }
  return <Outlet />
}
