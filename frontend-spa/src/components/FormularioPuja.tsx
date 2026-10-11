// Formulario para pujar (mutation placeBid). Muestra los errores del contrato con mensajes claros.
import { useMutation } from '@apollo/client/react'
import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { codigoError } from '../api/errores'
import { PLACE_BID, SUBASTA_TRAS_PUJA, type AuctionDetail } from '../api/items'
import { useSesion } from '../session/SessionContext'
import { formatearPrecio } from '../utils/formato'

// Atajos para subir la oferta sobre el precio actual.
const INCREMENTOS = [5000, 10000, 20000]

function mensajeDeError(error: unknown) {
  switch (codigoError(error)) {
    case 'BID_TOO_LOW':
      return 'Tu oferta debe superar el precio actual.'
    case 'INSUFFICIENT_FUNDS':
      return (
        <>
          No tienes saldo disponible suficiente. <Link to="/billetera">Recarga tu billetera</Link>.
        </>
      )
    case 'AUCTION_CLOSED':
      return 'Esta subasta ya terminó.'
    case 'UNAUTHENTICATED':
      return 'Tu sesión expiró. Vuelve a iniciar sesión.'
    case 'NOT_FOUND':
      return 'Esta subasta ya no existe.'
    case 'BAD_USER_INPUT':
      return 'Revisa el monto de tu oferta.'
    default:
      return 'No se pudo registrar la puja. Intenta de nuevo en un momento.'
  }
}

export function FormularioPuja({ subasta }: { subasta: AuctionDetail }) {
  const { usuario } = useSesion()
  const location = useLocation()
  const [monto, setMonto] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [pujaAceptada, setPujaAceptada] = useState<number | null>(null)

  const [pujar, { loading }] = useMutation(PLACE_BID, {
    // Actualiza de una vez el precio en pantalla; la suscripción trae el resto (participantes).
    update(cache, { data }) {
      if (!data) return
      cache.writeFragment({
        id: cache.identify({ __typename: 'Auction', id: subasta.id }),
        fragment: SUBASTA_TRAS_PUJA,
        data: { currentPrice: data.placeBid.amount, winningBid: data.placeBid },
      })
    },
  })

  if (!usuario) {
    return (
      <p>
        <Link to="/login" state={{ desde: location.pathname }}>
          Inicia sesión para pujar
        </Link>
      </p>
    )
  }

  if (subasta.status === 'CLOSED') {
    return <p>Esta subasta ya terminó: no recibe más pujas.</p>
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setError(null)
    setPujaAceptada(null)
    const cantidad = Number(monto)
    try {
      const { data } = await pujar({ variables: { auctionId: subasta.id, amount: cantidad } })
      if (data) {
        setPujaAceptada(data.placeBid.amount)
        setMonto('')
      }
    } catch (e) {
      setError(e)
    }
  }

  return (
    <form className="formulario formulario-puja" onSubmit={enviar}>
      <div className="atajos" role="group" aria-label="Subir la oferta rápido">
        {INCREMENTOS.map((incremento) => (
          <button
            key={incremento}
            type="button"
            className="boton-secundario"
            onClick={() => {
              const actual = Number(monto)
              const base = actual && actual >= subasta.currentPrice ? actual : subasta.currentPrice
              setMonto(String(base + incremento))
            }}
          >
            + {formatearPrecio(incremento)}
          </button>
        ))}
      </div>
      <label htmlFor="monto-puja">Tu oferta (COP)</label>
      <input
        id="monto-puja"
        type="number"
        inputMode="numeric"
        min={1}
        step="any"
        required
        placeholder={`Más de ${formatearPrecio(subasta.currentPrice)}`}
        value={monto}
        onChange={(evento) => setMonto(evento.target.value)}
      />
      <button type="submit" className="boton-pujar" disabled={loading}>
        {loading ? 'Enviando…' : 'Pujar'}
      </button>
      {error !== null && (
        <p role="alert" className="mensaje-error">
          {mensajeDeError(error)}
        </p>
      )}
      {pujaAceptada !== null && (
        <p role="status" className="mensaje-ok">
          Tu puja de {formatearPrecio(pujaAceptada)} quedó registrada.
        </p>
      )}
    </form>
  )
}
