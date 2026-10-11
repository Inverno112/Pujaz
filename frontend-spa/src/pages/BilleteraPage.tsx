// Mi billetera: saldo disponible y reservado, movimientos y recarga (wallet, deposit).
// Solo se llega aquí con sesión (RutaPrivada).
import { useMutation, useQuery } from '@apollo/client/react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { DEPOSIT, WALLET, type TipoMovimiento } from '../api/billetera'
import { codigoError } from '../api/errores'
import { formatearFecha, formatearPrecio } from '../utils/formato'

const NOMBRE_MOVIMIENTO: Record<TipoMovimiento, string> = {
  DEPOSIT: 'Recarga',
  RESERVE: 'Reserva por puja',
  REFUND: 'Reintegro',
}

// La reserva aparta dinero (sale del disponible); la recarga y el reintegro lo suman.
function signo(tipo: TipoMovimiento): string {
  return tipo === 'RESERVE' ? '−' : '+'
}

export function BilleteraPage() {
  const { data, loading, error, refetch } = useQuery(WALLET)
  const [monto, setMonto] = useState('')
  const [errorRecarga, setErrorRecarga] = useState<string | null>(null)
  const [recargado, setRecargado] = useState<number | null>(null)

  const [recargar, { loading: recargando }] = useMutation(DEPOSIT, {
    // La billetera no tiene id: se reemplaza a mano en la caché con la que devuelve `deposit`.
    update(cache, { data: resultado }) {
      if (resultado) cache.writeQuery({ query: WALLET, data: { wallet: resultado.deposit } })
    },
  })

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErrorRecarga(null)
    setRecargado(null)
    const cantidad = Number(monto)
    if (!(cantidad > 0)) {
      setErrorRecarga('El monto debe ser mayor que cero.')
      return
    }
    try {
      await recargar({ variables: { amount: cantidad } })
      setRecargado(cantidad)
      setMonto('')
    } catch (e) {
      setErrorRecarga(
        codigoError(e) === 'BAD_USER_INPUT'
          ? 'El monto debe ser mayor que cero.'
          : 'No se pudo hacer la recarga. Intenta de nuevo en un momento.',
      )
    }
  }

  if (loading) return <p>Cargando tu billetera…</p>

  if (error || !data) {
    return (
      <div role="alert" className="mensaje-error">
        <p>No se pudo cargar tu billetera. Intenta de nuevo en un momento.</p>
        <button type="button" onClick={() => void refetch()}>
          Reintentar
        </button>
      </div>
    )
  }

  const { available, reserved, movements } = data.wallet

  return (
    <section>
      <h1>Mi billetera</h1>

      <div className="saldos">
        <div className="saldo">
          <p className="categoria">Disponible para pujar</p>
          <p className="saldo-valor" aria-label="Saldo disponible">
            {formatearPrecio(available)}
          </p>
        </div>
        <div className="saldo">
          <p className="categoria">Reservado en pujas que vas ganando</p>
          <p className="saldo-valor" aria-label="Saldo reservado">
            {formatearPrecio(reserved)}
          </p>
        </div>
      </div>

      <h2>Recargar</h2>
      <form className="formulario pagina-angosta" onSubmit={enviar}>
        <label htmlFor="monto-recarga">Monto a recargar (COP)</label>
        <input
          id="monto-recarga"
          type="number"
          inputMode="numeric"
          min={1}
          step="any"
          required
          value={monto}
          onChange={(evento) => setMonto(evento.target.value)}
        />
        <button type="submit" disabled={recargando}>
          {recargando ? 'Recargando…' : 'Recargar'}
        </button>
        {recargado !== null && (
          <p role="status" className="mensaje-ok">
            Recargaste {formatearPrecio(recargado)}.
          </p>
        )}
        {errorRecarga && (
          <p role="alert" className="mensaje-error">
            {errorRecarga}
          </p>
        )}
      </form>

      <h2>Movimientos</h2>
      {movements.length === 0 ? (
        <p>Todavía no tienes movimientos.</p>
      ) : (
        <table className="tabla-movimientos">
          <thead>
            <tr>
              <th scope="col">Fecha</th>
              <th scope="col">Tipo</th>
              <th scope="col">Monto</th>
              <th scope="col">Subasta</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id}>
                <td>{formatearFecha(m.createdAt)}</td>
                <td>{NOMBRE_MOVIMIENTO[m.type]}</td>
                <td className={m.type === 'RESERVE' ? 'monto-negativo' : 'monto-positivo'}>
                  {signo(m.type)} {formatearPrecio(m.amount)}
                </td>
                <td>
                  {m.auction ? (
                    <Link to={`/items/${m.auction.item.id}`}>{m.auction.item.name}</Link>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
