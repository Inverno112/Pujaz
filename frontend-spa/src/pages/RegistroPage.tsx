// Crear cuenta (mutation register). Al terminar, la sesión queda iniciada.
import { useMutation } from '@apollo/client/react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { codigoError } from '../api/errores'
import { REGISTER } from '../api/usuarios'
import { useSesion } from '../session/SessionContext'

const MINIMO_CONTRASENA = 8

function mensajeDeError(error: unknown): string {
  switch (codigoError(error)) {
    case 'EMAIL_TAKEN':
      return 'Ya existe una cuenta con ese correo.'
    case 'BAD_USER_INPUT':
      return 'Revisa los datos: el correo debe ser válido y la contraseña de al menos 8 caracteres.'
    default:
      return 'No se pudo crear la cuenta. Intenta de nuevo en un momento.'
  }
}

export function RegistroPage() {
  const { usuario, iniciarSesion } = useSesion()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [registrar, { loading }] = useMutation(REGISTER)

  if (usuario) {
    return (
      <section>
        <h1>Crear cuenta</h1>
        <p>Ya iniciaste sesión como {usuario.name}.</p>
        <p>
          <Link to="/">Ir a las subastas</Link>
        </p>
      </section>
    )
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setError(null)
    if (password.length < MINIMO_CONTRASENA) {
      setError(`La contraseña debe tener al menos ${MINIMO_CONTRASENA} caracteres.`)
      return
    }
    try {
      const { data } = await registrar({
        variables: { input: { name: name.trim(), email: email.trim(), password } },
      })
      if (data) {
        iniciarSesion(data.register)
        navigate('/', { replace: true })
      }
    } catch (e) {
      setError(mensajeDeError(e))
    }
  }

  return (
    <section className="pagina-angosta">
      <h1>Crear cuenta</h1>
      <form className="formulario" onSubmit={enviar}>
        <label htmlFor="registro-nombre">Nombre</label>
        <input
          id="registro-nombre"
          autoComplete="name"
          required
          value={name}
          onChange={(evento) => setName(evento.target.value)}
        />
        <label htmlFor="registro-email">Correo</label>
        <input
          id="registro-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(evento) => setEmail(evento.target.value)}
        />
        <label htmlFor="registro-password">Contraseña (mínimo 8 caracteres)</label>
        <input
          id="registro-password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(evento) => setPassword(evento.target.value)}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Creando…' : 'Crear cuenta'}
        </button>
        {error && (
          <p role="alert" className="mensaje-error">
            {error}
          </p>
        )}
      </form>
      <p>
        ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
      </p>
    </section>
  )
}
