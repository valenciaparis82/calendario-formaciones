const madridParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

// Las fechas de calendario son cadenas YYYY-MM-DD, nunca instantes en la zona local.
export function todayInMadrid(now: Date = new Date()): string {
  const parts = madridParts.formatToParts(now)
  const get = (type: string) => parts.find((part) => part.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

function toUTC(date: string): Date {
  return new Date(`${date}T12:00:00Z`)
}

export function shiftDate(date: string, days: number): string {
  const result = toUTC(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result.toISOString().slice(0, 10)
}

export function mondayOf(date: string): string {
  const weekday = toUTC(date).getUTCDay()
  return shiftDate(date, -(weekday === 0 ? 6 : weekday - 1))
}

export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, index) => shiftDate(monday, index))
}

const fullDay = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'UTC',
  weekday: 'long',
})
const shortDate = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
})
const longDate = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export function dayName(date: string): string {
  return fullDay.format(toUTC(date))
}

export function dayAndMonth(date: string): string {
  return shortDate.format(toUTC(date))
}

export function readableDate(date: string): string {
  return longDate.format(toUTC(date))
}

export function weekLabel(monday: string): string {
  const sunday = shiftDate(monday, 6)
  const start = toUTC(monday)
  const end = toUTC(sunday)
  if (start.getUTCFullYear() !== end.getUTCFullYear()) {
    return `${dayAndMonth(monday)} ${start.getUTCFullYear()} — ${dayAndMonth(sunday)} ${end.getUTCFullYear()}`
  }
  if (start.getUTCMonth() === end.getUTCMonth()) {
    return `${start.getUTCDate()}–${end.getUTCDate()} de ${new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC', month: 'long' }).format(end)} de ${end.getUTCFullYear()}`
  }
  return `${dayAndMonth(monday)} — ${dayAndMonth(sunday)} de ${end.getUTCFullYear()}`
}

export function displayTime(time: string): string {
  return time.slice(0, 5)
}
