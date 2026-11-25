import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expandWeek, type Activity, type ActivityInput, type WeeklyException, type WeeklySeries } from './activities'
import { shiftDate } from './dates'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

export const isConfigured = Boolean(
  url && key && /^https:\/\/[^/]+\.supabase\.co\/?$/.test(url) &&
  !url.includes('TU-PROYECTO') && !key.includes('TU_CLAVE_PUBLICA') && !key.startsWith('sb_secret_'),
)

export const supabase: SupabaseClient | null = isConfigured ? createClient(url!, key!) : null

// Punto único de acceso a actividades: sustituible sin cambiar los componentes.
export const activitiesRepository = {
  async listWeek(monday: string): Promise<Activity[]> {
    if (!supabase) throw new Error('Supabase no está configurado.')
    const sunday = shiftDate(monday, 6)
    const { data, error } = await supabase
      .from('activities')
      .select('id, activity_date, start_time, end_time, title, description, link, color, created_at')
      .gte('activity_date', monday)
      .lte('activity_date', sunday)
      .order('activity_date')
      .order('start_time')
      .order('created_at')
    if (error) throw error
    // Excepciones trasladadas desde semanas anteriores o posteriores.
    const { data: exceptions, error: exceptionError } = await supabase.from('weekly_exceptions')
      .select('*')
      .or(`and(occurrence_date.gte.${monday},occurrence_date.lte.${sunday}),and(activity_date.gte.${monday},activity_date.lte.${sunday})`)
    if (exceptionError) throw exceptionError
    const movedIds = [...new Set((exceptions ?? []).filter((item) => item.activity_date >= monday && item.activity_date <= sunday).map((item) => item.series_id))]
    const { data: active, error: seriesError } = await supabase.from('weekly_series').select('*')
      .lte('start_date', sunday).or(`until_date.is.null,until_date.gte.${monday}`)
    if (seriesError) throw seriesError
    let series = active ?? []
    const missing = movedIds.filter((id) => !series.some((item) => item.id === id))
    if (missing.length) {
      const { data: extra, error: extraError } = await supabase.from('weekly_series').select('*').in('id', missing)
      if (extraError) throw extraError
      series = [...series, ...(extra ?? [])]
    }
    return expandWeek(monday, (data ?? []) as Activity[], series as WeeklySeries[], (exceptions ?? []) as WeeklyException[])
  },
  async create(input: ActivityInput): Promise<void> {
    if (!supabase) throw new Error('Supabase no está configurado.')
    const { error } = await supabase.from('activities').insert(input)
    if (error) throw error
  },
  async update(id: string, input: ActivityInput): Promise<void> {
    if (!supabase) throw new Error('Supabase no está configurado.')
    const { data, error } = await supabase.from('activities').update(input).eq('id', id).select('id')
    if (error) throw error
    if (!data?.length) throw new Error('No se pudo actualizar la actividad. Comprueba los permisos de administración.')
  },
  async remove(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase no está configurado.')
    const { data, error } = await supabase.from('activities').delete().eq('id', id).select('id')
    if (error) throw error
    if (!data?.length) throw new Error('No se pudo eliminar la actividad. Comprueba los permisos de administración.')
  },
  async createSeries(input: ActivityInput, until_date: string | null): Promise<void> {
    if (!supabase) throw new Error('Supabase no está configurado.')
    const { activity_date: start_date, ...fields } = input
    const { error } = await supabase.from('weekly_series').insert({ ...fields, start_date, until_date })
    if (error) throw error
  },
  async updateSeries(id: string, input: ActivityInput, until_date: string | null): Promise<void> {
    if (!supabase) throw new Error('Supabase no está configurado.')
    const { activity_date: start_date, ...fields } = input
    const { data, error } = await supabase.from('weekly_series').update({ ...fields, start_date, until_date }).eq('id', id).select('id')
    if (error) throw error
    if (!data?.length) throw new Error('No se pudo editar la serie. Comprueba los permisos.')
  },
  async removeSeries(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase no está configurado.')
    const { data, error } = await supabase.from('weekly_series').delete().eq('id', id).select('id')
    if (error) throw error
    if (!data?.length) throw new Error('No se pudo eliminar la serie. Comprueba los permisos.')
  },
  async saveOccurrence(activity: Activity, input: ActivityInput | null): Promise<void> {
    if (!supabase || !activity.series_id || !activity.occurrence_date) throw new Error('Aparición no válida.')
    const row = input
      ? { ...input, cancelled: false, series_id: activity.series_id, occurrence_date: activity.occurrence_date }
      : { series_id: activity.series_id, occurrence_date: activity.occurrence_date, cancelled: true,
        activity_date: null, start_time: null, end_time: null, title: null, description: null, link: null, color: null }
    const { error } = await supabase.from('weekly_exceptions').upsert(row as Record<string, string | boolean | null>, { onConflict: 'series_id,occurrence_date' })
    if (error) throw error
  },
  async getSeries(id: string): Promise<WeeklySeries> {
    if (!supabase) throw new Error('Supabase no está configurado.')
    const { data, error } = await supabase.from('weekly_series').select('*').eq('id', id).single()
    if (error) throw error
    return data as WeeklySeries
  },
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Se ha producido un error inesperado.'
}
