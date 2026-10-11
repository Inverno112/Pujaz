// Formatos para mostrar precios, fechas y estados en español de Colombia.
import type { AuctionStatus } from '../api/items'

const pesos = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

export function formatearPrecio(valor: number): string {
  return pesos.format(valor)
}

export function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function nombreEstado(estado: AuctionStatus): string {
  return estado === 'OPEN' ? 'Abierta' : 'Cerrada'
}

// Tiempo que falta, como en un reloj de subasta: "02:14:05" o "3 d 02:14:05".
export function formatearCuentaRegresiva(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const dias = Math.floor(total / 86400)
  const horas = Math.floor((total % 86400) / 3600)
  const minutos = Math.floor((total % 3600) / 60)
  const segundos = total % 60
  const reloj = [horas, minutos, segundos].map((n) => String(n).padStart(2, '0')).join(':')
  return dias > 0 ? `${dias} d ${reloj}` : reloj
}

// "Hace un momento", "Hace 5 min", "Hace 2 h" o la fecha si fue hace más de un día.
export function tiempoRelativo(iso: string, ahora: number = Date.now()): string {
  const segundos = Math.round((ahora - new Date(iso).getTime()) / 1000)
  if (segundos < 60) return 'Hace un momento'
  const minutos = Math.round(segundos / 60)
  if (minutos < 60) return `Hace ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `Hace ${horas} h`
  return formatearFecha(iso)
}
