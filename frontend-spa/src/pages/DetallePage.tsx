// Detalle de un artículo (query `item`).
// La sección «Subasta» muestra el panel en tiempo real y el formulario de puja (KAN-34).
import { useQuery } from '@apollo/client/react'
import { Link, useParams } from 'react-router-dom'
import { GET_ITEM } from '../api/items'
import { PanelSubasta } from '../components/PanelSubasta'
import { formatearPrecio } from '../utils/formato'

export function DetallePage() {
  const { id = '' } = useParams()
  const { data, loading, error, refetch } = useQuery(GET_ITEM, { variables: { id } })

  if (loading) return <p>Cargando artículo…</p>

  if (error) {
    return (
      <div role="alert" className="mensaje-error">
        <p>No se pudo cargar el artículo. Intenta de nuevo en un momento.</p>
        <button type="button" onClick={() => void refetch()}>
          Reintentar
        </button>
      </div>
    )
  }

  const item = data?.item
  if (!item) {
    return (
      <section>
        <h1>Artículo no encontrado</h1>
        <p>Este artículo no existe o fue retirado.</p>
        <Link to="/">Volver a las subastas</Link>
      </section>
    )
  }

  return (
    <article className="detalle">
      <Link to="/">← Volver a las subastas</Link>
      <h1>{item.name}</h1>
      {item.category && <p className="categoria">{item.category}</p>}

      {item.images.length > 0 && (
        <div className="galeria">
          {item.images.map((url, i) => (
            <img key={url} src={url} alt={`${item.name}, imagen ${i + 1}`} />
          ))}
        </div>
      )}

      {item.description && <p>{item.description}</p>}
      <p>
        Precio base: <strong>{formatearPrecio(item.basePrice)}</strong>
      </p>

      {item.documents.length > 0 && (
        <section>
          <h2>Documentos</h2>
          <ul>
            {item.documents.map((url, i) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noreferrer">
                  Documento {i + 1}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {item.auction ? (
        <PanelSubasta subasta={item.auction} />
      ) : (
        <section aria-labelledby="titulo-subasta" className="panel-subasta">
          <h2 id="titulo-subasta">Subasta</h2>
          <p>Este artículo todavía no tiene subasta.</p>
        </section>
      )}
    </article>
  )
}
