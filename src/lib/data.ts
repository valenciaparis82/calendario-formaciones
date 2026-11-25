import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Activity, ActivityInput } from './activities'
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
    const { data, error } = await supabase
      .from('activities')
      .select('id, activity_date, start_time, end_time, title, description, link, color, created_at')
      .gte('activity_date', monday)
      .lte('activity_date', shiftDate(monday, 6))
      .order('activity_date')
      .order('start_time')
      .order('created_at')
    if (error) throw error
    return (data ?? []) as Activity[]
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
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Se ha producido un error inesperado.'
}
