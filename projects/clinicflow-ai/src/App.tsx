import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, Check,
  ChevronDown, CircleHelp, Clock3, HeartPulse, LayoutDashboard, Menu,
  MessageCircle, MoreHorizontal, Plus, Send, Settings2, ShieldCheck,
  Sparkles, UserRound, UsersRound, X,
} from 'lucide-react'

type Appointment = {
  id: number
  patient_name: string
  phone: string
  starts_at: string
  status: string
}
type ChatMessage = { role: 'user' | 'assistant'; content: string }
type Overview = {
  clinic: { name: string; doctor: string; specialty: string; address: string; hours: string; consultation_fee: string }
  date: string
  appointment_count: number
  mode: 'demo' | 'openai'
}

const quickPrompts = [
  'What are the clinic hours?',
  'Check slots for tomorrow',
  'What is the consultation fee?',
]

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Something went wrong.' }))
    throw new Error(error.detail ?? 'Something went wrong.')
  }
  return response.json()
}

function localDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

function dateLabel(value: string) {
  const date = new Date(value)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) return 'Today'
  return new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).format(date)
}

function greeting() {
  const hour = new Date().getHours()
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
}

function App() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Good morning. I can help with clinic information and appointment availability. What would you like to know?' },
  ])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [bookingOpen, setBookingOpen] = useState(false)
  const [bookingDate, setBookingDate] = useState(localDate(new Date()))
  const [openSlots, setOpenSlots] = useState<string[]>([])
  const [selectedSlot, setSelectedSlot] = useState('')
  const [patientName, setPatientName] = useState('')
  const [phone, setPhone] = useState('')
  const [demoConsent, setDemoConsent] = useState(false)
  const [bookingError, setBookingError] = useState('')
  const [bookingSuccess, setBookingSuccess] = useState('')
  const [chatError, setChatError] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const dayCount = useMemo(() => appointments.filter((item) => item.starts_at.slice(0, 10) === localDate(new Date())).length, [appointments])

  async function refresh() {
    const [summary, schedule] = await Promise.all([
      api<Overview>('/overview'),
      api<Appointment[]>('/appointments'),
    ])
    setOverview(summary)
    setAppointments(schedule)
  }

  async function refreshSlots(day: string) {
    try {
      const result = await api<{ open_slots: string[] }>(`/availability?day=${day}`)
      setOpenSlots(result.open_slots)
      setSelectedSlot(result.open_slots[0] ?? '')
      setBookingError('')
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : 'Could not load available times.')
    }
  }

  useEffect(() => {
    refresh().catch(() => setChatError('Could not connect to the API. Start the backend and refresh this page.'))
    void refreshSlots(localDate(new Date()))
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  useEffect(() => {
    if (bookingOpen) void refreshSlots(bookingDate)
  }, [bookingOpen, bookingDate])

  async function sendMessage(event?: FormEvent, preset?: string) {
    event?.preventDefault()
    const content = (preset ?? draft).trim()
    if (!content || sending) return
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content }]
    setMessages(nextMessages)
    setDraft('')
    setSending(true)
    setChatError('')
    try {
      const result = await api<{ answer: string; mode: string }>('/chat', {
        method: 'POST', body: JSON.stringify({ messages: nextMessages.slice(-12) }),
      })
      setMessages([...nextMessages, { role: 'assistant', content: result.answer }])
      setOverview((current) => current ? { ...current, mode: result.mode === 'openai' ? 'openai' : current.mode } : current)
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Could not send your message.')
    } finally {
      setSending(false)
    }
  }

  async function submitBooking(event: FormEvent) {
    event.preventDefault()
    setBookingError('')
    setBookingSuccess('')
    if (!selectedSlot) {
      setBookingError('Choose an available time first.')
      return
    }
    try {
      const created = await api<Appointment>('/appointments', {
        method: 'POST',
        body: JSON.stringify({ patient_name: patientName, phone, starts_at: selectedSlot, demo_consent: demoConsent }),
      })
      await refresh()
      setBookingSuccess(`Confirmed for ${timeLabel(created.starts_at)} on ${dateLabel(created.starts_at)}.`)
      setPatientName('')
      setPhone('')
      setDemoConsent(false)
      await refreshSlots(bookingDate)
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : 'Could not save this appointment.')
    }
  }

  const todayAppointments = appointments.filter((item) => item.starts_at.slice(0, 10) === localDate(new Date()))
  const upcomingAppointments = appointments.filter((item) => item.starts_at.slice(0, 10) !== localDate(new Date())).slice(0, 2)

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark"><HeartPulse size={20} strokeWidth={2.6} /></div>
          <div><span className="brand-name">clinicflow</span><span className="brand-ai">AI</span></div>
          <button className="icon-button mobile-close" aria-label="Close menu" onClick={() => setMobileNavOpen(false)}><X size={18} /></button>
        </div>

        <div className="workspace-switcher">
          <div className="clinic-avatar">N</div>
          <div className="workspace-copy"><strong>{overview?.clinic.name ?? 'Northstar Clinic'}</strong><span>Independent practice</span></div>
          <ChevronDown size={15} className="muted" />
        </div>

        <div className="nav-label">WORKSPACE</div>
        <nav className="nav-list" aria-label="Main navigation">
          <button className="nav-item active"><LayoutDashboard size={17} /><span>Overview</span></button>
          <button className="nav-item" onClick={() => setBookingOpen(true)}><CalendarDays size={17} /><span>Appointments</span><span className="nav-count">{dayCount}</span></button>
          <button className="nav-item" onClick={() => document.getElementById('agent-panel')?.scrollIntoView({ behavior: 'smooth' })}><MessageCircle size={17} /><span>AI front desk</span><span className="live-dot" /></button>
          <button className="nav-item"><UsersRound size={17} /><span>Patients</span><span className="soon-tag">DEMO</span></button>
        </nav>

        <div className="nav-label nav-label-lower">PREFERENCES</div>
        <nav className="nav-list">
          <button className="nav-item"><Settings2 size={17} /><span>Clinic settings</span></button>
          <button className="nav-item"><CircleHelp size={17} /><span>Help & feedback</span></button>
        </nav>

        <div className="sidebar-bottom">
          <div className="privacy-card"><div className="privacy-icon"><ShieldCheck size={16} /></div><div><strong>Privacy first</strong><p>Demo uses synthetic data only.</p></div></div>
          <div className="profile-row"><div className="profile-avatar">AR</div><div className="profile-copy"><strong>Dr. Ananya Rao</strong><span>Clinic administrator</span></div><MoreHorizontal size={18} className="muted" /></div>
        </div>
      </aside>

      {mobileNavOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setMobileNavOpen(true)}><Menu size={19} /></button><span>Workspace</span><span className="crumb-separator">/</span><strong>Overview</strong></div>
          <div className="topbar-actions"><div className="system-status"><span className="status-dot" /> All systems operational</div><button className="top-avatar" aria-label="Profile">AR</button></div>
        </header>

        <div className="page-content">
          {chatError && <div className="connection-alert"><Activity size={16} />{chatError}<button onClick={() => { setChatError(''); refresh().catch(() => setChatError('API is still unreachable.')) }}>Retry</button></div>}
          <section className="welcome-row">
            <div><div className="eyebrow"><span className="eyebrow-line" /> {new Intl.DateTimeFormat('en-IN', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase()}</div><h1>{greeting()}, Dr. Rao <span className="wave">✦</span></h1><p className="welcome-subtitle">Here’s what’s happening at your clinic today.</p></div>
            <div className="welcome-actions"><button className="button button-secondary"><ArrowDownRight size={16} /> Export report</button><button className="button button-primary" onClick={() => setBookingOpen(true)}><Plus size={17} /> New appointment</button></div>
          </section>

          <section className="demo-banner"><div className="banner-sparkle"><Sparkles size={17} /></div><div><strong>Portfolio demo · fictional clinic and sample records</strong><p>Do not enter real patient data. AI answers admin questions only and does not provide medical advice.</p></div><a href="https://github.com" target="_blank" rel="noreferrer">How it works <ArrowRight size={14} /></a></section>

          <section className="stats-grid" aria-label="Clinic metrics">
            <article className="stat-card"><div className="stat-top"><span>Appointments today</span><span className="stat-icon violet"><CalendarDays size={16} /></span></div><div className="stat-value">{overview?.appointment_count ?? '—'}<span className="stat-suffix"> visits</span></div><div className="stat-foot"><span className="trend positive"><ArrowUpRight size={13} /> Live schedule</span><span>Updated just now</span></div></article>
            <article className="stat-card"><div className="stat-top"><span>Available slots</span><span className="stat-icon mint"><Clock3 size={16} /></span></div><div className="stat-value">{openSlots.length}<span className="stat-suffix"> today</span></div><div className="stat-foot"><span className="trend neutral"><span className="tiny-dot" /> 30-minute slots</span><span>9 am – 5 pm</span></div></article>
            <article className="stat-card"><div className="stat-top"><span>Front desk assistant</span><span className="stat-icon blue"><Sparkles size={16} /></span></div><div className="stat-value stat-online">Online<span className="online-pip" /></div><div className="stat-foot"><span className="trend positive"><span className="tiny-dot" /> {overview?.mode === 'openai' ? 'Live AI enabled' : 'Demo mode'}</span><span>Admin support only</span></div></article>
            <article className="stat-card savings-card"><div className="stat-top"><span>Calls recovered</span><span className="stat-icon sand"><MessageCircle size={16} /></span></div><div className="stat-value">—<span className="stat-suffix"> pilot metric</span></div><div className="stat-foot"><span className="trend neutral"><span className="tiny-dot" /> Not yet measured</span><span>Connect phone line</span></div></article>
          </section>

          <section className="workspace-grid">
            <div className="left-column">
              <section className="panel schedule-panel">
                <div className="panel-heading"><div><div className="section-kicker">YOUR DAY</div><h2>Today’s schedule <span className="count-pill">{todayAppointments.length}</span></h2></div><button className="text-button" onClick={() => setBookingOpen(true)}>Manage schedule <ArrowRight size={15} /></button></div>
                <div className="schedule-date"><div className="date-icon"><CalendarDays size={17} /></div><div><strong>{new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</strong><span>Appointments · {overview?.clinic.doctor ?? 'Dr. Ananya Rao'}</span></div><button className="icon-button schedule-more" aria-label="More schedule options"><MoreHorizontal size={19} /></button></div>
                <div className="appointment-list">
                  {todayAppointments.length === 0 && <div className="empty-state">No appointments for today. Add a demo booking to see it here.</div>}
                  {todayAppointments.map((item, index) => <article className="appointment-row" key={item.id}><div className="time-column"><strong>{timeLabel(item.starts_at)}</strong><span>{index === 0 ? 'NEXT' : 'VISIT'}</span></div><div className={`timeline-marker ${index === 0 ? 'marker-active' : ''}`}><span /></div><div className="patient-avatar" style={{ '--avatar-hue': `${(index * 51 + 194) % 360}` } as React.CSSProperties}>{item.patient_name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><div className="appointment-copy"><strong>{item.patient_name}</strong><span>General consultation <i>·</i> {item.phone}</span></div><div className="appointment-status"><span className="confirmed-dot" /> Confirmed</div><button className="icon-button row-more" aria-label="Appointment options"><MoreHorizontal size={18} /></button></article>)}
                </div>
                {upcomingAppointments.length > 0 && <div className="upcoming-strip"><span>UP NEXT</span>{upcomingAppointments.map((item) => <div className="upcoming-item" key={item.id}><strong>{dateLabel(item.starts_at)}</strong><span>{timeLabel(item.starts_at)} · {item.patient_name}</span></div>)}</div>}
              </section>

              <section className="panel insights-panel"><div className="panel-heading compact"><div><div className="section-kicker">PILOT TRACKING</div><h2>Prove the value</h2></div><span className="pilot-tag">Measurement needed</span></div><div className="insights-body"><div className="insight-illustration"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="insight-center"><Activity size={23} /></div><span className="orbit-node node-one"><Clock3 size={13} /></span><span className="orbit-node node-two"><CalendarDays size={13} /></span><span className="orbit-node node-three"><UsersRound size={13} /></span></div><div className="insight-copy"><strong>Don’t guess at savings.</strong><p>Track staff hours, missed enquiries, booked visits, and running costs during a clinic pilot. Only report savings that show up in real clinic records.</p><button className="inline-link" onClick={() => setBookingOpen(true)}>Explore demo workflow <ArrowRight size={14} /></button></div></div></section>
            </div>

            <section className="panel agent-panel" id="agent-panel">
              <div className="agent-header"><div className="agent-title-wrap"><div className="agent-icon"><Sparkles size={18} /></div><div><h2>AI front desk</h2><span><span className="agent-status" /> Ready to help</span></div></div><button className="icon-button" aria-label="Assistant options"><MoreHorizontal size={19} /></button></div>
              <div className="agent-capabilities"><span><ShieldCheck size={13} /> Admin-only assistant</span><span className="mode-pill">{overview?.mode === 'openai' ? 'LIVE AI' : 'DEMO MODE'}</span></div>

              <div className="chat-body">
                <div className="chat-date-divider"><span /> TODAY <span /></div>
                {messages.map((message, index) => <div className={`chat-message ${message.role}`} key={`${index}-${message.role}`}><div className={`message-avatar ${message.role === 'assistant' ? 'bot-avatar' : ''}`}>{message.role === 'assistant' ? <Sparkles size={14} /> : <UserRound size={14} />}</div><div className="message-content"><div className="message-meta"><strong>{message.role === 'assistant' ? 'ClinicFlow' : 'You'}</strong><span>{index === 0 ? '9:41 am' : 'Now'}</span></div><div className="message-bubble">{message.content}</div></div></div>)}
                {sending && <div className="chat-message assistant"><div className="message-avatar bot-avatar"><Sparkles size={14} /></div><div className="typing-indicator"><span /><span /><span /></div></div>}
                <div ref={chatEndRef} />
              </div>

              <div className="quick-prompts"><span>TRY ASKING</span><div>{quickPrompts.map((prompt) => <button key={prompt} onClick={() => sendMessage(undefined, prompt)}>{prompt}</button>)}</div></div>
              <form className="chat-composer" onSubmit={(event) => sendMessage(event)}><input aria-label="Ask the front desk assistant" placeholder="Ask about hours, fees, or appointment slots…" value={draft} onChange={(event) => setDraft(event.target.value)} /><button type="submit" aria-label="Send message" disabled={!draft.trim() || sending}><Send size={16} /></button></form>
              <div className="chat-footnote"><ShieldCheck size={12} /> No diagnosis or treatment advice · Demo records only</div>
            </section>
          </section>

          <footer className="page-footer"><span>© 2026 ClinicFlow AI <i>·</i> Portfolio prototype</span><div><button>Privacy</button><button>Feedback</button><span className="api-status"><span className="status-dot" /> API connected</span></div></footer>
        </div>
      </main>

      {bookingOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setBookingOpen(false) }}><section className="booking-modal" role="dialog" aria-modal="true" aria-labelledby="booking-title"><div className="modal-heading"><div><span className="section-kicker">SCHEDULE</span><h2 id="booking-title">New appointment</h2></div><button className="icon-button" onClick={() => { setBookingOpen(false); setBookingSuccess('') }} aria-label="Close"><X size={19} /></button></div><p className="modal-notice"><ShieldCheck size={15} /> Demo only. Enter synthetic details, not real patient information.</p><form onSubmit={submitBooking} className="booking-form"><label>Patient name<input required minLength={2} maxLength={100} value={patientName} onChange={(event) => setPatientName(event.target.value)} placeholder="e.g. Demo Patient" /></label><label>Phone number<input required minLength={8} maxLength={18} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="e.g. +91 90000 00000" /></label><label>Appointment date<input required type="date" min={localDate(new Date())} value={bookingDate} onChange={(event) => setBookingDate(event.target.value)} /></label><fieldset className="slot-fieldset"><legend>Available time</legend>{openSlots.length ? <div className="slot-grid">{openSlots.map((slot) => <button type="button" className={`slot-option ${selectedSlot === slot ? 'selected' : ''}`} key={slot} onClick={() => setSelectedSlot(slot)}>{timeLabel(slot)}</button>)}</div> : <div className="no-slots">No open slots on this date. Choose another date.</div>}</fieldset><label className="consent-line"><input type="checkbox" checked={demoConsent} onChange={(event) => setDemoConsent(event.target.checked)} /> I confirm these are fictional demo details and understand this prototype is not for real patient data.</label>{bookingError && <div className="form-error">{bookingError}</div>}{bookingSuccess && <div className="form-success"><Check size={15} /> {bookingSuccess}</div>}<div className="modal-actions"><button className="button button-secondary" type="button" onClick={() => setBookingOpen(false)}>Cancel</button><button className="button button-primary" type="submit" disabled={!selectedSlot || !demoConsent}><Check size={16} /> Confirm demo booking</button></div></form></section></div>}
    </div>
  )
}

export default App
