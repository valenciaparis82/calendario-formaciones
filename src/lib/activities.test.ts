import { describe, expect, it } from 'vitest'
import { expandWeek, type Activity, type WeeklyException, type WeeklySeries } from './activities'

const series: WeeklySeries = {
  id: 'serie', start_date: '2026-03-22', until_date: null, start_time: '09:00:00',
  end_time: '10:00:00', title: 'Curso', description: 'Original', link: 'https://example.com',
  color: 'aqua', created_at: '2026-01-01T00:00:00Z',
}
const edited: WeeklyException = {
  series_id: series.id, occurrence_date: '2026-03-29', cancelled: false,
  activity_date: '2026-03-29', start_time: '11:00', end_time: '12:00',
  title: 'Especial', description: null, link: 'https://example.org', color: 'mint',
}

describe('apariciones semanales', () => {
  it('respeta comienzo, fin inclusivo, límites entre semanas y cambios de hora de Madrid', () => {
    const bounded = { ...series, until_date: '2026-04-05' }
    expect(expandWeek('2026-03-16', [], [bounded], [])).toHaveLength(1)
    expect(expandWeek('2026-03-23', [], [bounded], [])[0]).toMatchObject({
      activity_date: '2026-03-29', start_time: '09:00:00',
    })
    expect(expandWeek('2026-03-30', [], [bounded], [])[0].activity_date).toBe('2026-04-05')
    expect(expandWeek('2026-04-06', [], [bounded], [])).toHaveLength(0)
    expect(expandWeek('2026-03-09', [], [bounded], [])).toHaveLength(0)
  })

  it('conserva el resto de la serie y sus excepciones al cambiar la plantilla', () => {
    const updated = { ...series, title: 'Nuevo título', start_time: '10:00:00' }
    expect(expandWeek('2026-03-23', [], [updated], [edited])[0]).toMatchObject({
      title: 'Especial', start_time: '11:00', description: null, color: 'mint',
    })
    expect(expandWeek('2026-03-30', [], [updated], [edited])[0]).toMatchObject({
      title: 'Nuevo título', start_time: '10:00:00', activity_date: '2026-04-05',
    })
  })

  it('cancela una aparición sin afectar las demás y no duplica apariciones trasladadas', () => {
    const cancelled: WeeklyException = { series_id: 'serie', occurrence_date: '2026-03-29', cancelled: true }
    expect(expandWeek('2026-03-23', [], [series], [cancelled])).toHaveLength(0)
    expect(expandWeek('2026-03-30', [], [series], [cancelled])).toHaveLength(1)
    const moved = { ...edited, activity_date: '2026-04-01' }
    expect(expandWeek('2026-03-23', [], [series], [moved])).toHaveLength(0)
    expect(expandWeek('2026-03-30', [], [series], [moved])).toHaveLength(2)
    expect(expandWeek('2026-03-30', [], [series], [moved]).filter((a) => a.title === 'Especial')).toHaveLength(1)
  })

  it('mantiene las actividades antiguas de una sola fecha', () => {
    const single: Activity = { ...series, id: 'single', activity_date: '2026-03-29' }
    const result = expandWeek('2026-03-23', [single], [series], [])
    expect(result).toHaveLength(2)
    expect(result[0].series_id).toBeUndefined()
  })
})
