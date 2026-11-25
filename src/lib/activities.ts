export const COLORS = {
  aqua: { name: 'Turquesa', label: 'Formación' },
  blue: { name: 'Azul', label: 'Sesión' },
  lilac: { name: 'Lila', label: 'Presentación' },
  peach: { name: 'Melocotón', label: 'Encuentro' },
  mint: { name: 'Menta', label: 'Actividad' },
} as const

export type ActivityColor = keyof typeof COLORS

export interface ActivityInput {
  activity_date: string
  start_time: string
  end_time: string
  title: string
  description: string | null
  link: string
  color: ActivityColor
}

export interface Activity extends ActivityInput {
  id: string
  created_at: string
  series_id?: string
  occurrence_date?: string
}

export interface WeeklySeries extends Omit<ActivityInput, 'activity_date'> {
  id: string
  start_date: string
  until_date: string | null
  created_at: string
}

export interface WeeklyException extends Partial<ActivityInput> {
  series_id: string
  occurrence_date: string
  cancelled: boolean
}

// Fechas civiles, no instantes UTC: 09:00 sigue siendo 09:00 en Madrid
// tanto en invierno como en verano.
export function expandWeek(monday: string, singles: Activity[], series: WeeklySeries[], exceptions: WeeklyException[]): Activity[] {
  const sunday = new Date(`${monday}T12:00:00Z`)
  sunday.setUTCDate(sunday.getUTCDate() + 6)
  const end = sunday.toISOString().slice(0, 10)
  const byOccurrence = new Map(exceptions.map((item) => [`${item.series_id}:${item.occurrence_date}`, item]))
  const result = [...singles]
  for (const item of series) {
    // También se incluyen excepciones trasladadas desde fuera de esta semana.
    const moved = exceptions.filter((exception) => exception.series_id === item.id &&
      !exception.cancelled && exception.activity_date! >= monday && exception.activity_date! <= end)
    const origins = new Set(moved.map((exception) => exception.occurrence_date))
    const first = new Date(`${item.start_date}T12:00:00Z`)
    const start = new Date(`${monday}T12:00:00Z`)
    const delta = (first.getUTCDay() - start.getUTCDay() + 7) % 7
    start.setUTCDate(start.getUTCDate() + delta)
    const origin = start.toISOString().slice(0, 10)
    if (origin >= item.start_date && (!item.until_date || origin <= item.until_date)) origins.add(origin)
    for (const date of origins) {
      if (date < item.start_date || (item.until_date && date > item.until_date)) continue
      const exception = byOccurrence.get(`${item.id}:${date}`)
      if (exception?.cancelled) continue
      const displayed = exception?.activity_date ?? date
      if (displayed < monday || displayed > end) continue
      result.push({
        id: `${item.id}:${date}`, series_id: item.id, occurrence_date: date,
        created_at: item.created_at, activity_date: displayed,
        start_time: exception?.start_time ?? item.start_time,
        end_time: exception?.end_time ?? item.end_time,
        title: exception?.title ?? item.title,
        description: exception && !exception.cancelled ? exception.description ?? null : item.description,
        link: exception?.link ?? item.link, color: exception?.color ?? item.color,
      })
    }
  }
  return result.sort((a, b) => a.activity_date.localeCompare(b.activity_date) ||
    a.start_time.localeCompare(b.start_time) || a.created_at.localeCompare(b.created_at))
}

export function validateActivity(input: ActivityInput): string | null {
  if (!input.title.trim()) return 'El título es obligatorio.'
  if (input.title.trim().length > 160) return 'El título no puede superar los 160 caracteres.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.activity_date) ||
    Number.isNaN(Date.parse(`${input.activity_date}T12:00:00Z`)) ||
    new Date(`${input.activity_date}T12:00:00Z`).toISOString().slice(0, 10) !== input.activity_date) {
    return 'Introduce una fecha válida.'
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.start_time) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.end_time) ||
    input.end_time <= input.start_time) {
    return 'La hora de fin debe ser posterior a la de inicio.'
  }
  if (input.description && input.description.length > 2000) return 'La descripción no puede superar los 2000 caracteres.'
  try {
    const url = new URL(input.link)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Protocolo no válido')
  } catch {
    return 'Introduce un enlace válido que empiece por https:// o http://.'
  }
  if (!(input.color in COLORS)) return 'Selecciona un color de la paleta.'
  return null
}
