// Panel de la subasta en tiempo real: se suscribe a `auctionUpdated` (publicar-suscribir).
// Cada puja aceptada llega por WebSocket y Apollo actualiza la subasta en la caché.
import { useSubscription } from '@apollo/client/react'
import { AUCTION_UPDATED, type AuctionDetail } from '../api/items'
import { useSesion } from '../session/SessionContext'
import { formatearFecha, formatearPrecio, nombreEstado } from '../utils/formato'
import { FormularioPuja } from './FormularioPuja'

export function PanelSubasta({ subasta }: { subasta: AuctionDetail }) {
  const { usuario } = useSesion()
  useSubscription(AUCTION_UPDATED, { variables: { auctionId: subasta.id } })

  const ganador = subasta.winningBid?.bidder
  const vaGanando = Boolean(usuario && ganador?.id === usuario.id)
  const teSuperaron =
    Boolean(usuario) && !vaGanando && subasta.participants.some((p) => p.id === usuario?.id)

  return (
    <section aria-labelledby="titulo-subasta" className="panel-subasta">
      <h2 id="titulo-subasta">Subasta</h2>
      <p className="precio-actual">
        Precio actual: <strong>{formatearPrecio(subasta.currentPrice)}</strong>
      </p>
      <p>Estado: {nombreEstado(subasta.status)}</p>
      <p>Cierra: {formatearFecha(subasta.endsAt)}</p>

      {subasta.winningBid ? (
        <p>
          Va ganando: <strong>{ganador?.name}</strong> con {formatearPrecio(subasta.winningBid.amount)}
        </p>
      ) : (
        <p>Todavía no hay pujas. ¡Sé el primero!</p>
      )}
      {vaGanando && <p className="mensaje-ok">Vas ganando esta subasta.</p>}
      {teSuperaron && <p className="mensaje-error">Te superaron. Puedes volver a pujar.</p>}

      <h3>Participantes ({subasta.participants.length})</h3>
      {subasta.participants.length > 0 ? (
        <ul aria-label="Participantes">
          {subasta.participants.map((p) => (
            <li key={p.id}>{p.name}</li>
          ))}
        </ul>
      ) : (
        <p>Nadie ha pujado todavía.</p>
      )}

      <FormularioPuja subasta={subasta} />
    </section>
  )
}
