// Marco común de todas las páginas: encabezado con el menú y el contenido debajo.
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useSesion } from '../session/SessionContext'

export function Layout() {
  const { usuario, cerrarSesion } = useSesion()
  const navigate = useNavigate()

  function salir() {
    navigate('/')
    cerrarSesion()
  }

  return (
    <>
      <header className="layout-header">
        <Link to="/" className="layout-logo">
          Pujaz
        </Link>
        <nav className="layout-nav" aria-label="Menú principal">
          <NavLink to="/" end>
            Subastas
          </NavLink>
          {usuario ? (
            <>
              <NavLink to="/billetera">Mi billetera</NavLink>
              <NavLink to="/perfil">Mi perfil</NavLink>
            </>
          ) : (
            <NavLink to="/login">Iniciar sesión</NavLink>
          )}
        </nav>
        {usuario && (
          <div className="layout-usuario">
            <span>Hola, {usuario.name}</span>
            <button type="button" className="boton-enlace" onClick={salir}>
              Cerrar sesión
            </button>
          </div>
        )}
      </header>
      <main className="layout-main">
        <Outlet />
      </main>
    </>
  )
}
