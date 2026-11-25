import { describe, expect, it } from 'vitest'
import { mondayOf, shiftDate, todayInMadrid, weekDays, weekLabel } from './dates'
import { validateActivity, type ActivityInput } from './activities'

describe('semanas con fechas reales', () => {
  it('empieza en lunes incluso para domingo y cruza de año', () => {
    expect(mondayOf('2026-11-29')).toBe('2026-11-23')
    expect(weekDays('2026-12-28')).toEqual(['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03'])
    expect(weekLabel('2026-12-28')).toContain('2027')
  })
  it('navega semanas sin errores por cambio de hora', () => {
    expect(shiftDate('2026-03-23', 7)).toBe('2026-03-30')
    expect(shiftDate('2026-10-26', -7)).toBe('2026-10-19')
  })
  it('determina el día de Madrid sin usar la zona del dispositivo', () => {
    expect(todayInMadrid(new Date('2026-07-01T22:30:00Z'))).toBe('2026-07-02')
    expect(todayInMadrid(new Date('2026-01-01T23:30:00Z'))).toBe('2026-01-02')
  })
})

describe('validación de actividades', () => {
  const valid: ActivityInput = { activity_date: '2026-11-25', start_time: '09:00', end_time: '10:00', title: 'Formación', description: null, link: 'https://example.com', color: 'aqua' }
  it('admite una actividad válida', () => expect(validateActivity(valid)).toBeNull())
  it('exige título y horas coherentes', () => {
    expect(validateActivity({ ...valid, title: ' ' })).toMatch(/título/)
    expect(validateActivity({ ...valid, end_time: '09:00' })).toMatch(/posterior/)
  })
  it('rechaza esquemas inseguros y fechas imposibles', () => {
    expect(validateActivity({ ...valid, link: 'javascript:alert(1)' })).toMatch(/enlace/)
    expect(validateActivity({ ...valid, activity_date: '2026-02-30' })).toMatch(/fecha/)
  })
})
