import { useMutation } from '@apollo/client/react'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CREATE_ITEM } from '../api/items'
import { mensajeErrorServidor } from '../api/errores'

export function PublicarPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  const [createItem, { loading }] = useMutation(CREATE_ITEM, {
    onCompleted(data) {
      // Redirigimos al detalle del artículo recién creado
      if (data?.createItem) {
        navigate(`/items/${data.createItem.id}`)
      }
    },
    onError(e) {
      setError(mensajeErrorServidor(e))
    },
  })

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd = new FormData(e.currentTarget)
    const name = fd.get('name') as string
    const description = fd.get('description') as string
    const category = fd.get('category') as string
    const imageUrl = fd.get('imageUrl') as string
    const basePrice = Number(fd.get('basePrice'))
    // Para endsAt, tomamos la fecha/hora local del input datetime-local y la pasamos a ISO
    const endsAtRaw = fd.get('endsAt') as string
    let endsAt: string | undefined
    if (endsAtRaw) {
      endsAt = new Date(endsAtRaw).toISOString()
    }

    createItem({
      variables: {
        input: {
          name,
          description: description || undefined,
          category: category || undefined,
          images: imageUrl ? [imageUrl] : [],
          basePrice,
          endsAt,
        },
      },
      // El listado no está montado mientras se publica: se borra `items` de la caché
      // para que se vuelva a pedir al volver a "/" (también limpia búsquedas viejas).
      update(cache) {
        cache.evict({ fieldName: 'items' })
        cache.gc()
      },
    })
  }

  return (
    <section className="pagina-angosta">
      <h1>Publicar Artículo</h1>
      <p>Añade un nuevo artículo para que la comunidad empiece a pujar de inmediato.</p>

      {error && <div className="mensaje-error">{error}</div>}

      <form className="formulario" onSubmit={enviar}>
        <label htmlFor="name">Nombre del artículo</label>
        <input id="name" name="name" type="text" required autoFocus placeholder="Ej: Reloj de Oro" />

        <label htmlFor="description">Descripción</label>
        <textarea id="description" name="description" rows={3} placeholder="Breve historia, detalles o estado del ítem..." />

        <label htmlFor="category">Categoría</label>
        <input id="category" name="category" type="text" placeholder="Ej: Antigüedades, Arte, Relojería" />

        <label htmlFor="imageUrl">URL de la imagen (opcional)</label>
        <input id="imageUrl" name="imageUrl" type="url" placeholder="https://..." />

        <label htmlFor="basePrice">Precio base de subasta ($ COP)</label>
        <input id="basePrice" name="basePrice" type="number" required min="1000" step="1000" defaultValue="50000" />

        <label htmlFor="endsAt">Fecha de cierre (opcional)</label>
        <input id="endsAt" name="endsAt" type="datetime-local" />
        <small style={{ color: 'var(--gris)', marginTop: '-4px' }}>Si lo dejas vacío, el sistema asignará una duración por defecto.</small>

        <button type="submit" disabled={loading} style={{ marginTop: '24px' }}>
          {loading ? 'Publicando...' : 'Publicar artículo'}
        </button>
      </form>
    </section>
  )
}
