// Listado de artículos en subasta con buscador (query `items`).
import { useQuery } from '@apollo/client/react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { GET_ITEMS } from '../api/items'
import { ImagenLote } from '../components/ImagenLote'
import { formatearPrecio, nombreEstado } from '../utils/formato'

export function ListadoPage() {
  // Lo que la persona escribe en la caja de texto.
  const [texto, setTexto] = useState('')
  // Lo que de verdad se busca (cambia solo al enviar el formulario).
  const [busqueda, setBusqueda] = useState('')

  const { data, loading, error, refetch } = useQuery(GET_ITEMS, {
    variables: { search: busqueda || null },
  })

  function buscar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setBusqueda(texto.trim())
  }

  return (
    <section className="listado">
      <header className="encabezado-pagina">
        <h1>Subastas</h1>
        <p className="entradilla">Piezas abiertas a puja. Entra a cada una para ver su historia y ofertar.</p>
      </header>

      <form role="search" className="buscador" onSubmit={buscar}>
        <label htmlFor="buscador-texto" className="solo-lector">
          Buscar artículos
        </label>
        <input
          id="buscador-texto"
          type="search"
          placeholder="Busca por nombre o descripción"
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
        />
        <button type="submit">Buscar</button>
      </form>

      {loading && <p className="nota">Cargando artículos…</p>}

      {error && (
        <div role="alert" className="mensaje-error">
          <p>No se pudieron cargar los artículos. Intenta de nuevo en un momento.</p>
          <button type="button" onClick={() => void refetch()}>
            Reintentar
          </button>
        </div>
      )}

      {data && data.items.length === 0 && (
        <p className="nota">
          {busqueda
            ? `No hay artículos que coincidan con «${busqueda}».`
            : 'Todavía no hay artículos en subasta.'}
        </p>
      )}

      {data && data.items.length > 0 && (
        <ul className="catalogo">
          {data.items.map((item) => (
            <li key={item.id} className="tarjeta-lote">
              <ImagenLote src={item.images[0]} alt="" nombre={item.name} />
              <div className="tarjeta-lote__cuerpo">
                {item.category && <p className="categoria">{item.category}</p>}
                <h2>
                  <Link to={`/items/${item.id}`}>{item.name}</Link>
                </h2>
                <p className="tarjeta-lote__precio">
                  {item.auction ? 'Precio actual' : 'Precio base'}
                  <strong>{formatearPrecio(item.auction?.currentPrice ?? item.basePrice)}</strong>
                </p>
                {item.auction ? (
                  <p className={`estado estado--${item.auction.status === 'OPEN' ? 'abierta' : 'cerrada'}`}>
                    Subasta {nombreEstado(item.auction.status).toLowerCase()}
                  </p>
                ) : (
                  <p className="estado">Aún sin subasta</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
