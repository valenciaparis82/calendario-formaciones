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
