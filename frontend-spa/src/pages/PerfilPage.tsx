// Mi perfil: ver y editar los datos (updateUser) o eliminar la cuenta (deleteUser).
// Solo se llega aquí con sesión (RutaPrivada).
import { useMutation } from '@apollo/client/react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { codigoError } from '../api/errores'
import { DELETE_USER, UPDATE_USER, type Usuario } from '../api/usuarios'
import { useSesion } from '../session/SessionContext'
import { formatearFecha } from '../utils/formato'

function mensajeDeError(error: unknown): string {
  switch (codigoError(error)) {
    case 'EMAIL_TAKEN':
      return 'Ya existe otra cuenta con ese correo.'
    case 'BAD_USER_INPUT':
      return 'Revisa los datos: el correo debe ser válido y la contraseña de al menos 8 caracteres.'
    case 'UNAUTHENTICATED':
      return 'Tu sesión expiró. Vuelve a iniciar sesión.'
    default:
      return 'No se pudieron guardar los cambios. Intenta de nuevo en un momento.'
  }
}

export function PerfilPage() {
  const { usuario } = useSesion()
  // RutaPrivada garantiza que hay usuario.
  return usuario ? <Perfil usuario={usuario} /> : null
}

function Perfil({ usuario }: { usuario: Usuario }) {
  const { cerrarSesion } = useSesion()
  const navigate = useNavigate()

  const [name, setName] = useState(usuario.name)
  const [email, setEmail] = useState(usuario.email)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false)

  const [actualizar, { loading: guardando }] = useMutation(UPDATE_USER)
  const [eliminar, { loading: eliminando }] = useMutation(DELETE_USER)

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setError(null)
    setGuardado(false)
    if (password && password.length < 8) {
      setError('La contraseña nueva debe tener al menos 8 caracteres.')
      return
    }
    // Solo se envía lo que cambió.
    const input: { name?: string; email?: string; password?: string } = {}
    if (name.trim() !== usuario.name) input.name = name.trim()
    if (email.trim() !== usuario.email) input.email = email.trim()
    if (password) input.password = password
    if (Object.keys(input).length === 0) {
      setError('No hay cambios para guardar.')
      return
    }
    try {
      await actualizar({ variables: { input } })
      setPassword('')
      setGuardado(true)
    } catch (e) {
      setError(mensajeDeError(e))
    }
  }

  async function borrarCuenta() {
    setError(null)
    try {
      const { data } = await eliminar()
      if (data?.deleteUser) {
        navigate('/', { replace: true })
        cerrarSesion()
      }
    } catch (e) {
      setError(mensajeDeError(e))
    }
  }

  return (
    <section className="pagina-angosta">
      <h1>Mi perfil</h1>
      <p>
        <strong>{usuario.name}</strong> · {usuario.email}
      </p>
      <p className="categoria">Miembro desde {formatearFecha(usuario.createdAt)}</p>

      <h2>Editar mis datos</h2>
      <form className="formulario" onSubmit={guardar}>
        <label htmlFor="perfil-nombre">Nombre</label>
        <input
          id="perfil-nombre"
          required
          value={name}
          onChange={(evento) => setName(evento.target.value)}
        />
        <label htmlFor="perfil-email">Correo</label>
        <input
          id="perfil-email"
          type="email"
          required
          value={email}
          onChange={(evento) => setEmail(evento.target.value)}
        />
        <label htmlFor="perfil-password">Contraseña nueva (opcional)</label>
        <input
          id="perfil-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(evento) => setPassword(evento.target.value)}
        />
        <button type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
        {guardado && (
          <p role="status" className="mensaje-ok">
            Tus datos quedaron guardados.
          </p>
        )}
        {error && (
          <p role="alert" className="mensaje-error">
            {error}
          </p>
        )}
      </form>

      <h2>Eliminar cuenta</h2>
      {confirmandoBorrado ? (
        <div className="zona-peligro">
          <p>¿Seguro? Esta acción no se puede deshacer.</p>
          <button type="button" onClick={() => void borrarCuenta()} disabled={eliminando}>
            Sí, eliminar mi cuenta
          </button>{' '}
          <button type="button" onClick={() => setConfirmandoBorrado(false)}>
            Cancelar
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirmandoBorrado(true)}>
          Eliminar mi cuenta
        </button>
      )}
    </section>
  )
}
