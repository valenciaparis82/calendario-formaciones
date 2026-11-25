import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronLeft, ChevronRight,
  Clock3, ExternalLink, LockKeyhole, LogOut, Plus, ShieldCheck, Sparkles, Trash2, X,
} from 'lucide-react'
import { type Activity, type ActivityColor, type ActivityInput, COLORS, validateActivity } from './lib/activities'
import { activitiesRepository, errorMessage, isConfigured, supabase } from './lib/data'
import { dayAndMonth, dayName, displayTime, mondayOf, readableDate, shiftDate, todayInMadrid, weekDays, weekLabel } from './lib/dates'

const isAdminRoute = /^\/admin\/?$/.test(window.location.pathname)

function ActivityCard({ activity, onEdit, onDelete }: {
  activity: Activity
  onEdit?: (activity: Activity) => void
  onDelete?: (activity: Activity) => void
}) {
  return (
    <article className={`activity-card color-${activity.color}`}>
      <div className="activity-topline">
        <span className="activity-type"><span className="type-dot" />{COLORS[activity.color]?.label ?? 'Actividad'}</span>
        {onEdit && onDelete && (
          <div className="card-actions">
            <button type="button" className="icon-action" onClick={() => onEdit(activity)} aria-label={`Editar ${activity.title}`} title="Editar">✎</button>
            <button type="button" className="icon-action" onClick={() => onDelete(activity)} aria-label={`Eliminar ${activity.title}`} title="Eliminar"><Trash2 size={14} /></button>
          </div>
        )}
      </div>
      <h3>{activity.title}</h3>
      <p className="activity-time"><Clock3 size={14} aria-hidden="true" />{displayTime(activity.start_time)} – {displayTime(activity.end_time)}</p>
      {activity.description && <p className="activity-description">{activity.description}</p>}
      <a className="activity-link" href={activity.link} target="_blank" rel="noopener noreferrer" aria-label={`Abrir enlace de ${activity.title} (se abre en una pestaña nueva)`}>
        Abrir enlace <ArrowUpRight size={15} aria-hidden="true" />
      </a>
    </article>
  )
}

function Calendar({ monday, activities, loading, error, admin, onEdit, onDelete, onAdd }: {
  monday: string
  activities: Activity[]
  loading: boolean
  error: string | null
  admin: boolean
  onEdit: (activity: Activity) => void
  onDelete: (activity: Activity) => void
  onAdd: (date: string) => void
}) {
  const today = todayInMadrid()
  const days = weekDays(monday)
  return (
    <section className="calendar-section" aria-label="Calendario semanal">
      <div className="section-heading">
        <div className="section-icon"><CalendarDays size={20} aria-hidden="true" /></div>
        <div>
          <p className="eyebrow">TU SEMANA, DE UN VISTAZO</p>
          <h2>Agenda semanal</h2>
        </div>
        <span className="timezone-pill"><span className="live-dot" /> Horario de Madrid</span>
      </div>
      {error && <div role="alert" className="notice notice-error">No se pudo cargar el calendario: {error}</div>}
      <div className="week-grid" aria-busy={loading}>
        {days.map((date, index) => {
          const dayActivities = activities.filter((item) => item.activity_date === date)
          return (
            <div key={date} className={`day-column ${date === today ? 'is-today' : ''}`}>
              <div className="day-heading">
                <span className="day-index">0{index + 1} / 07</span>
                <div className="day-title-row">
                  <span className="day-title">{dayName(date)}</span>
                  {date === today && <span className="today-tag">HOY</span>}
                </div>
                <span className="day-date">{dayAndMonth(date)}</span>
              </div>
              <div className="day-content">
                {loading ? <div className="day-empty">Cargando…</div> :
                  error ? <div className="day-empty">No disponible</div> :
                    dayActivities.length ? dayActivities.map((activity) => (
                      <ActivityCard key={activity.id} activity={activity} onEdit={admin ? onEdit : undefined} onDelete={admin ? onDelete : undefined} />
                    )) : <div className="day-empty"><span className="empty-line" />Sin actividades</div>}
                {admin && !loading && !error && (
                  <button type="button" className="add-day" onClick={() => onAdd(date)}><Plus size={15} /> Añadir actividad</button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Login({ onLogin, busy, error }: {
  onLogin: (email: string, password: string) => Promise<void>
  busy: boolean
  error: string | null
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    await onLogin(email, password)
  }
  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <span className="login-symbol"><LockKeyhole size={24} /></span>
        <p className="eyebrow">ACCESO RESTRINGIDO</p>
        <h2>Área de administración</h2>
        <p className="muted">Solo la cuenta autorizada puede gestionar las actividades.</p>
        <label htmlFor="login-email">Correo electrónico</label>
        <input id="login-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <label htmlFor="login-password">Contraseña</label>
        <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-primary login-submit" type="submit" disabled={busy}>{busy ? 'Accediendo…' : 'Iniciar sesión'} <ArrowRight size={17} /></button>
        <a className="back-link" href="/"><ArrowLeft size={15} /> Volver al calendario</a>
      </form>
    </div>
  )
}

function emptyInput(date: string): ActivityInput {
  return { activity_date: date, start_time: '09:00', end_time: '10:00', title: '', description: null, link: '', color: 'aqua' }
}

function ActivityForm({ date, editing, onClose, onSaved }: {
  date: string
  editing: Activity | null
  onClose: () => void
  onSaved: () => void
}) {
  const [input, setInput] = useState<ActivityInput>(() => editing ? { ...editing } : emptyInput(date))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href]') ?? [])
    focusable()[1]?.focus()
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') { closeRef.current(); return }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (!items.length) return
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length - 1].focus() }
      else if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0].focus() }
    }
    document.addEventListener('keydown', handleKey)
    return () => { document.removeEventListener('keydown', handleKey); previousFocus?.focus() }
  }, [])
  function update<K extends keyof ActivityInput>(key: K, value: ActivityInput[K]) {
    setInput((previous) => ({ ...previous, [key]: value }))
    setError(null)
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    const payload = { ...input, title: input.title.trim(), description: input.description?.trim() || null, link: input.link.trim() }
    const validation = validateActivity(payload)
    if (validation) { setError(validation); return }
    setSaving(true)
    setError(null)
    try {
      if (editing) await activitiesRepository.update(editing.id, payload)
      else await activitiesRepository.create(payload)
      onSaved()
    } catch (cause) {
      setError(`No se guardó la actividad. ${errorMessage(cause)}`)
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="form-title">
        <div className="modal-heading">
          <div><p className="eyebrow">GESTIÓN DE ACTIVIDADES</p><h2 id="form-title">{editing ? 'Editar actividad' : 'Nueva actividad'}</h2></div>
          <button type="button" className="close-button" onClick={onClose} aria-label="Cerrar formulario"><X size={20} /></button>
        </div>
        <form onSubmit={submit}>
          <label htmlFor="activity-title">Título <span className="required">*</span></label>
          <input id="activity-title" required maxLength={160} value={input.title} onChange={(event) => update('title', event.target.value)} placeholder="Nombre de la actividad" />
          <div className="form-row">
            <div><label htmlFor="activity-date">Fecha <span className="required">*</span></label><input id="activity-date" type="date" required value={input.activity_date} onChange={(event) => update('activity_date', event.target.value)} /></div>
            <div><label htmlFor="activity-color">Color</label><select id="activity-color" value={input.color} onChange={(event) => update('color', event.target.value as ActivityColor)}>{Object.entries(COLORS).map(([key, color]) => <option key={key} value={key}>{color.name}</option>)}</select></div>
          </div>
          <div className="form-row">
            <div><label htmlFor="activity-start">Hora de inicio <span className="required">*</span></label><input id="activity-start" type="time" required value={displayTime(input.start_time)} onChange={(event) => update('start_time', event.target.value)} /></div>
            <div><label htmlFor="activity-end">Hora de fin <span className="required">*</span></label><input id="activity-end" type="time" required value={displayTime(input.end_time)} onChange={(event) => update('end_time', event.target.value)} /></div>
          </div>
          <label htmlFor="activity-description">Descripción <span className="optional">(opcional)</span></label>
          <textarea id="activity-description" rows={3} maxLength={2000} value={input.description ?? ''} onChange={(event) => update('description', event.target.value)} placeholder="Detalles para los asistentes" />
          <label htmlFor="activity-link">Enlace <span className="required">*</span></label>
          <input id="activity-link" type="url" required value={input.link} onChange={(event) => update('link', event.target.value)} placeholder="https://ejemplo.com/reunion" />
          <p className="input-help">Solo enlaces HTTP o HTTPS. La actividad se guarda en Supabase.</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-footer">
            <button type="button" className="button button-quiet" onClick={onClose}>Cancelar</button>
            <button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear actividad'} <Check size={17} /></button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function App() {
  const [monday, setMonday] = useState(() => mondayOf(todayInMadrid()))
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(isConfigured)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [admin, setAdmin] = useState(false)
  const [authLoading, setAuthLoading] = useState(isAdminRoute && isConfigured)
  const [loginBusy, setLoginBusy] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [adminEmail, setAdminEmail] = useState('')
  const [form, setForm] = useState<{ date: string; editing: Activity | null } | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!isConfigured) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError(null)
      try {
        const result = await activitiesRepository.listWeek(monday)
        if (!cancelled) setActivities(result)
      } catch (cause) {
        if (!cancelled) { setActivities([]); setLoadError(errorMessage(cause)) }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [monday, revision])

  const verifySession = useCallback(async () => {
    if (!supabase) return
    setAuthLoading(true)
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) { setAdmin(false); setAdminEmail(''); return }
      const { data: allowed, error } = await supabase.rpc('is_admin')
      if (error) throw error
      if (!allowed) {
        setAdmin(false)
        setAuthError('Esta cuenta no tiene permiso de administración.')
        await supabase.auth.signOut()
        return
      }
      setAdminEmail(user.email ?? '')
      setAdmin(true)
      setAuthError(null)
    } catch (cause) {
      setAdmin(false)
      setAuthError(`No se pudo verificar el acceso: ${errorMessage(cause)}`)
    } finally {
      setAuthLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAdminRoute || !supabase) return
    void verifySession()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        // Supabase recomienda no llamar a métodos de auth dentro del callback síncrono.
        setTimeout(() => { void verifySession() }, 0)
      }
    })
    return () => subscription.unsubscribe()
  }, [verifySession])

  async function login(email: string, password: string) {
    if (!supabase) return
    setLoginBusy(true)
    setAuthError(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      await verifySession()
    } catch (cause) {
      setAuthError(`No se pudo iniciar sesión: ${errorMessage(cause)}`)
    } finally {
      setLoginBusy(false)
    }
  }

  async function logout() {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) setActionError(`No se pudo cerrar sesión: ${error.message}`)
    else { setAdmin(false); setForm(null) }
  }

  async function remove(activity: Activity) {
    if (!window.confirm(`¿Eliminar «${activity.title}» del ${readableDate(activity.activity_date)}? Esta acción no se puede deshacer.`)) return
    setActionError(null)
    try {
      await activitiesRepository.remove(activity.id)
      setRevision((value) => value + 1)
    } catch (cause) {
      setActionError(`No se eliminó la actividad. ${errorMessage(cause)}`)
    }
  }

  const canEdit = isAdminRoute && admin && isConfigured
  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Calendario semanal, inicio">
          <span className="brand-mark"><span /><span /><span /><span /></span>
          <span>ASR <span className="brand-plus">/</span> INMOVERSE</span>
        </a>
        <div className="topbar-right">
          <span className="topbar-caption"><span className="status-dot" /> AGENDA DE FORMACIÓN</span>
          {canEdit && <button type="button" onClick={logout} className="logout-button"><LogOut size={15} /> Cerrar sesión</button>}
        </div>
      </header>

      <main>
        {isAdminRoute && !isConfigured ? (
          <div className="config-screen"><ConfigurationNotice /><a className="back-link" href="/">Volver al calendario</a></div>
        ) : isAdminRoute && (authLoading || (!admin && !authError && loginBusy)) ? (
          <div className="loading-screen" role="status">Verificando acceso…</div>
        ) : isAdminRoute && !admin ? (
          <Login onLogin={login} busy={loginBusy} error={authError} />
        ) : (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="hero-kicker"><Sparkles size={14} /> {canEdit ? 'PANEL DE ADMINISTRACIÓN' : 'UN ESPACIO PARA APRENDER Y CONECTAR'}</div>
                <h1>Calendario <span>semanal<span className="title-period">.</span></span></h1>
                <p className="hero-subtitle">Formaciones y presentaciones <strong>ASR e INMOVERSE</strong></p>
                <p className="hero-detail">Todas las citas de la semana, en un solo lugar. Explora la agenda y accede a cada actividad cuando llegue el momento.</p>
                <div className="hero-meta"><span className="meta-line" /><span>DE LUNES A DOMINGO</span><span className="meta-separator">·</span><span>HORA PENINSULAR</span></div>
              </div>
              <div className="hero-art" aria-hidden="true">
                <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
                <div className="art-glow" />
                <div className="art-card art-back"><span>MIÉ</span><span className="art-lines"><i /><i /></span></div>
                <div className="art-card art-front"><span className="art-card-top">TU PRÓXIMA SEMANA <ArrowUpRight size={14} /></span><span className="art-number">07</span><span className="art-card-bottom">DÍAS PARA DESCUBRIR</span><span className="art-grid"><i /><i /><i /><i /><i /><i /><i /></span></div>
                <div className="art-star star-one">✳</div><div className="art-star star-two">✦</div>
              </div>
            </section>
            {!isConfigured && <ConfigurationNotice />}
            {canEdit && <div className="admin-banner"><ShieldCheck size={19} /><div><strong>Sesión de administración activa</strong><span>{adminEmail} · Los cambios se guardan en Supabase y se muestran a todos los visitantes.</span></div></div>}
            {actionError && <div className="notice notice-error" role="alert">{actionError}</div>}
            <div className="agenda-bar">
              <div><p className="eyebrow">EXPLORA EL CALENDARIO</p><h2>{weekLabel(monday)}</h2><p className="agenda-bar-sub">Selecciona una semana para ver sus actividades.</p></div>
              <div className="week-controls" aria-label="Navegación entre semanas">
                <button type="button" className="nav-arrow" onClick={() => setMonday((date) => shiftDate(date, -7))} aria-label="Semana anterior"><ChevronLeft size={20} /></button>
                <button type="button" className="today-button" onClick={() => setMonday(mondayOf(todayInMadrid()))}>Hoy</button>
                <button type="button" className="nav-arrow" onClick={() => setMonday((date) => shiftDate(date, 7))} aria-label="Semana siguiente"><ChevronRight size={20} /></button>
              </div>
            </div>
            <Calendar monday={monday} activities={activities} loading={loading} error={loadError} admin={canEdit} onEdit={(activity) => setForm({ date: activity.activity_date, editing: activity })} onDelete={(activity) => { void remove(activity) }} onAdd={(date) => setForm({ date, editing: null })} />
            {canEdit && <button type="button" className="button button-primary floating-add" onClick={() => setForm({ date: todayInMadrid(), editing: null })}><Plus size={18} /> Nueva actividad</button>}
            <div className="after-calendar"><span><span className="legend-dot" /> Horarios en Europe/Madrid</span><span>Una semana para seguir creciendo <ExternalLink size={14} /></span></div>
          </>
        )}
      </main>
      <footer className="footer"><span className="footer-brand">ASR <span>/</span> INMOVERSE</span><span>Calendario semanal · Formaciones y presentaciones</span><span>Hecho para estar al día.</span></footer>
      {canEdit && form && <ActivityForm key={form.editing?.id ?? `new-${form.date}`} date={form.date} editing={form.editing} onClose={() => setForm(null)} onSaved={() => { setForm(null); setRevision((value) => value + 1) }} />}
    </div>
  )
}

function ConfigurationNotice() {
  return <div className="notice notice-config" role="status"><LockKeyhole size={20} aria-hidden="true" /><div><strong>Supabase aún no está configurado.</strong><p>El calendario no puede cargar actividades ni guardar cambios. Configura <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> siguiendo el README. No se muestran datos de ejemplo.</p></div></div>
}
