/** Formato legible de la fecha en que se ganó un nivel (tarjeta compartible). */
export function formatEarnedDate(iso: string): string {
  return new Date(iso.replace(/\.\d{1,6}(?=[+-Z]|$)/, '')).toLocaleDateString('es-MX', {
    day:   'numeric',
    month: 'long',
    year:  'numeric',
  })
}
