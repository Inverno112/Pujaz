// Detalle de un artículo (query `item`).
// La sección «Subasta» muestra el panel en tiempo real y el formulario de puja (KAN-34).
import { useQuery } from '@apollo/client/react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { GET_ITEM } from '../api/items'
import { ImagenLote } from '../components/ImagenLote'
import { PanelSubasta } from '../components/PanelSubasta'
import { formatearPrecio } from '../utils/formato'

export function DetallePage() {
  const { id = '' } = useParams()
  const { data, loading, error, refetch } = useQuery(GET_ITEM, { variables: { id } })

  if (loading) return <p className="nota">Cargando artículo…</p>

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
      <section className="pagina-angosta">
        <h1>Artículo no encontrado</h1>
        <p>Este artículo no existe o fue retirado.</p>
        <Link to="/">Volver a las subastas</Link>
      </section>
    )
  }

  return (
    <article className="detalle">
      <Link to="/" className="volver">
        ← Volver a las subastas
      </Link>

      <div className="detalle__rejilla">
        <div className="detalle__principal">
          <Galeria nombre={item.name} imagenes={item.images} />

          <div className="detalle__ficha">
            {item.category && <p className="categoria">{item.category}</p>}
            <h1>{item.name}</h1>
            {item.description && <p className="descripcion">{item.description}</p>}
            <p className="precio-base">
              Precio base <strong>{formatearPrecio(item.basePrice)}</strong>
            </p>

            {item.documents.length > 0 && (
              <section className="documentos">
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
          </div>
        </div>

        <aside className="detalle__lateral">
          {item.auction ? (
            <PanelSubasta subasta={item.auction} />
          ) : (
            <section aria-labelledby="titulo-subasta" className="panel-subasta">
              <h2 id="titulo-subasta">Subasta</h2>
              <p>Este artículo todavía no tiene subasta.</p>
            </section>
          )}
        </aside>
      </div>
    </article>
  )
}

// Foto grande y miniaturas: al elegir una miniatura cambia la foto grande.
function Galeria({ nombre, imagenes }: { nombre: string; imagenes: string[] }) {
  const [elegida, setElegida] = useState(0)

  return (
    <div className="detalle__galeria">
      <ImagenLote
        key={imagenes[elegida]}
        src={imagenes[elegida]}
        alt={`${nombre}, imagen ${elegida + 1}`}
        nombre={nombre}
        className="imagen-lote--grande"
      />
      {imagenes.length > 1 && (
        <div className="miniaturas">
          {imagenes.map((url, i) => (
            <button
              key={url}
              type="button"
              className={`miniatura${i === elegida ? ' miniatura--activa' : ''}`}
              aria-label={`Ver imagen ${i + 1}`}
              aria-pressed={i === elegida}
              onClick={() => setElegida(i)}
            >
              <ImagenLote src={url} alt="" nombre={nombre} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
