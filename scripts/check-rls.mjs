import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

function readEnv(path) {
  if (!fs.existsSync(path)) throw new Error(`Falta ${path}. Configúralo antes de ejecutar la prueba.`)
  return Object.fromEntries(
    fs.readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .filter((line) => /^[A-Z_]+=.*/.test(line))
      .map((line) => {
        const index = line.indexOf('=')
        const value = line.slice(index + 1).trim()
        return [line.slice(0, index), value.replace(/^(['"])(.*)\1$/, '$2')]
      }),
  )
}

const connection = readEnv('.env.local')
const credentials = readEnv('.env.rls.local')
const url = connection.VITE_SUPABASE_URL
const key = connection.VITE_SUPABASE_PUBLISHABLE_KEY
const email = credentials.RLS_TEST_EMAIL
const password = credentials.RLS_TEST_PASSWORD
if (!url || !key || !email || !password || key.startsWith('sb_secret_')) {
  throw new Error('Faltan valores de conexión o se ha facilitado una clave secreta. No se ejecutó ninguna petición.')
}

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const probeId = randomUUID()
let original
let probeCreated = false
let authenticated = false

function assertReadable(result, step) {
  if (result.error) throw new Error(`${step}: ${result.error.message} (${result.error.code})`)
  return result.data
}

try {
  const { data: login, error: loginError } = await client.auth.signInWithPassword({ email, password })
  if (loginError || !login.user) throw new Error(`No se pudo iniciar sesión con la cuenta de prueba: ${loginError?.message ?? 'sin usuario'}`)
  authenticated = true
  const { data: isAdmin, error: roleError } = await client.rpc('is_admin')
  if (roleError) throw new Error(`No se pudo verificar el rol del usuario: ${roleError.message}`)
  if (isAdmin !== false) throw new Error('La cuenta de prueba aparece como administradora. No se ejecutan intentos de escritura.')
  console.log('Rol verificado: usuario autenticado no administrador.')

  const rows = assertReadable(
    await client.from('activities')
      .select('id, activity_date, start_time, end_time, title, description, link, color, created_at')
      .eq('title', 'Prueba de permisos'),
    'Lectura',
  )
  if (rows.length !== 1) {
    throw new Error(`Se esperaban exactamente 1 actividad «Prueba de permisos», encontradas: ${rows.length}. No se prueba escritura sin una fila inequívoca.`)
  }
  original = rows[0]
  console.log('Lectura con usuario no administrador: permitida; actividad de prueba encontrada.')

  const proposed = {
    id: probeId,
    activity_date: original.activity_date,
    start_time: original.start_time,
    end_time: original.end_time,
    title: 'SONDA RLS (eliminar si se creó)',
    description: null,
    link: 'https://example.com/',
    color: 'aqua',
  }
  const insert = await client.from('activities').insert(proposed).select('id')
  probeCreated = !insert.error && (insert.data?.length ?? 0) > 0
  console.log(`Insertar: ${insert.error ? `denegado (${insert.error.code})` : `respuesta sin error; filas: ${insert.data?.length ?? 0}`}.`)
  if (probeCreated) throw new Error(`ALERTA: el usuario insertó una actividad. UUID para limpieza manual: ${probeId}. Se detienen más escrituras.`)
  if (!insert.error) throw new Error('La inserción no devolvió un error de autorización. Revisar la política antes de continuar.')

  const update = await client.from('activities')
    .update({ title: 'SONDA RLS: CAMBIO NO AUTORIZADO' })
    .eq('id', original.id).select('id')
  console.log(`Editar: ${update.error ? `denegado (${update.error.code})` : `${update.data?.length ?? 0} filas afectadas`}.`)
  if (!update.error && (update.data?.length ?? 0) > 0) {
    throw new Error('ALERTA: se pudo editar la actividad de prueba. Se detiene la prueba antes del borrado.')
  }

  const deletion = await client.from('activities').delete().eq('id', original.id).select('id')
  console.log(`Eliminar: ${deletion.error ? `denegado (${deletion.error.code})` : `${deletion.data?.length ?? 0} filas afectadas`}.`)
  if (!deletion.error && (deletion.data?.length ?? 0) > 0) {
    throw new Error('ALERTA: se pudo borrar la actividad de prueba.')
  }

  const after = assertReadable(
    await client.from('activities')
      .select('id, activity_date, start_time, end_time, title, description, link, color, created_at')
      .eq('id', original.id).maybeSingle(),
    'Comprobación final',
  )
  if (JSON.stringify(after) !== JSON.stringify(original)) throw new Error('ALERTA: la actividad original no coincide con su estado anterior.')
  console.log('Integridad: la actividad original permanece intacta.')
  console.log('Resultado: la cuenta de prueba puede leer; no pudo crear, editar ni eliminar.')
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Error desconocido.')
  process.exitCode = 1
} finally {
  if (authenticated) {
    // Siempre leer de nuevo el estado de la fila original, incluso si una prueba anterior falla.
    if (original) {
      const check = await client.from('activities').select('id, title').eq('id', original.id).maybeSingle()
      if (check.error || !check.data || check.data.title !== original.title) {
        console.error('ATENCIÓN: la actividad de prueba falta o tiene un título distinto al original.')
        process.exitCode = 1
      }
    }
    if (probeCreated) {
      console.error(`ATENCIÓN: queda una actividad de sonda para limpieza manual. UUID: ${probeId}`)
      process.exitCode = 1
    }
    await client.auth.signOut()
  }
}
