// Foto de una pieza. Si no hay foto o no carga, muestra un marco vacío con la inicial,
// para que el catálogo no quede con huecos.
import { useState } from 'react'

interface Props {
  src?: string
  alt: string
  nombre: string
  className?: string
}

export function ImagenLote({ src, alt, nombre, className = '' }: Props) {
  const [fallo, setFallo] = useState(false)

  if (!src || fallo) {
    return (
      <div className={`imagen-lote imagen-lote--vacia ${className}`} aria-hidden="true">
        <span>{nombre.charAt(0)}</span>
      </div>
    )
  }

  return (
    <img
      className={`imagen-lote ${className}`}
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFallo(true)}
    />
  )
}
