// Reloj de la subasta: cuánto falta para el cierre, actualizado cada segundo.
import { useEffect, useState } from 'react'
import { formatearCuentaRegresiva } from '../utils/formato'

export function CuentaRegresiva({ hasta }: { hasta: string }) {
  const [ahora, setAhora] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const restante = new Date(hasta).getTime() - ahora

  return (
    <p className="cuenta-regresiva" aria-label="Tiempo restante">
      <span className="cuenta-regresiva__etiqueta">Cierra en</span>
      <time dateTime={hasta}>{restante > 0 ? formatearCuentaRegresiva(restante) : 'Cerrando…'}</time>
    </p>
  )
}
