// Panel de la subasta en tiempo real: se suscribe a `auctionUpdated` (publicar-suscribir).
// Cada puja aceptada llega por WebSocket y Apollo actualiza la subasta en la caché.
import { useSubscription } from '@apollo/client/react'
import { useState } from 'react'
import { AUCTION_UPDATED, type AuctionDetail, type Bid } from '../api/items'
import { useSesion } from '../session/SessionContext'
import { formatearFecha, formatearPrecio, nombreEstado, tiempoRelativo } from '../utils/formato'
import { Avatar } from './Avatar'
import { CuentaRegresiva } from './CuentaRegresiva'
import { FormularioPuja } from './FormularioPuja'

export function PanelSubasta({ subasta }: { subasta: AuctionDetail }) {
  const { usuario } = useSesion()
  useSubscription(AUCTION_UPDATED, { variables: { auctionId: subasta.id } })

  // Actividad reciente: la puja ganadora inicial y cada puja nueva que llega mientras
  // la página está abierta (el contrato no trae el historial completo).
  const [actividad, setActividad] = useState<Bid[]>(() =>
    subasta.winningBid ? [subasta.winningBid] : [],
  )
  if (subasta.winningBid && actividad[0]?.id !== subasta.winningBid.id) {
    setActividad([subasta.winningBid, ...actividad].slice(0, 6))
  }

  const abierta = subasta.status === 'OPEN'
  const ganador = subasta.winningBid?.bidder
  const vaGanando = Boolean(usuario && ganador?.id === usuario.id)
  const teSuperaron =
    Boolean(usuario) && !vaGanando && subasta.participants.some((p) => p.id === usuario?.id)

  return (
    <section aria-labelledby="titulo-subasta" className="panel-subasta">
      <div className="panel-subasta__cabecera">
        <h2 id="titulo-subasta">Subasta</h2>
        {abierta ? (
          <span className="en-vivo">En vivo</span>
        ) : (
          <span className="cerrada">Cerrada</span>
        )}
      </div>

      {abierta && <CuentaRegresiva hasta={subasta.endsAt} />}

      <p className="precio-actual">
        Precio actual
        <strong>
          {formatearPrecio(subasta.currentPrice)} <span className="moneda">COP</span>
        </strong>
      </p>
      <p className="subasta-meta">
        <span className={`estado estado--${abierta ? 'abierta' : 'cerrada'}`}>
          Estado: {nombreEstado(subasta.status)}
        </span>
        <span>Cierra: {formatearFecha(subasta.endsAt)}</span>
      </p>

      {vaGanando && <p className="aviso aviso--ok">Vas ganando esta subasta.</p>}
      {teSuperaron && <p className="aviso aviso--error">Te superaron. Puedes volver a pujar.</p>}

      {subasta.winningBid ? (
        <p className="va-ganando">
          Va ganando <strong>{ganador?.name}</strong> con {formatearPrecio(subasta.winningBid.amount)}
        </p>
      ) : (
        <p className="va-ganando">Todavía no hay pujas. Puedes ser el primero.</p>
      )}

      {actividad.length > 0 && (
        <>
          <h3>Actividad reciente</h3>
          <ol className="actividad" aria-label="Actividad reciente">
            {actividad.map((puja, i) => {
              const anterior = actividad[i + 1]
              return (
                <li key={puja.id}>
                  <Avatar nombre={puja.bidder.name} />
                  <span className="actividad__quien">
                    {puja.bidder.name}
                    <small>{tiempoRelativo(puja.createdAt)}</small>
                  </span>
                  <span className="actividad__monto">
                    {formatearPrecio(puja.amount)}
                    {anterior && <small>+ {formatearPrecio(puja.amount - anterior.amount)}</small>}
                  </span>
                </li>
              )
            })}
          </ol>
        </>
      )}

      <h3>Participantes ({subasta.participants.length})</h3>
      {subasta.participants.length > 0 ? (
        <ul aria-label="Participantes" className="participantes">
          {subasta.participants.map((p) => (
            <li key={p.id}>
              <Avatar nombre={p.name} />
              {p.name}
            </li>
          ))}
        </ul>
      ) : (
        <p className="nota">Nadie ha pujado todavía.</p>
      )}

      <FormularioPuja subasta={subasta} />
    </section>
  )
}
