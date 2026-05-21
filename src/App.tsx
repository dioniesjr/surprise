import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'

type WeatherData = {
  locationName: string
  temperature: number
  windSpeed: number
  weatherCode: number
}

type WeatherInsight = WeatherData & {
  summary: string
  hint: string
}

type UserInput = {
  name: string
  city: string
  focus: string
  availableHours: number
  energy: number
}

type PlanItem = {
  time: string
  title: string
  details: string
}

type PlanResponse = {
  weather: WeatherInsight
  advice: string
  timeline: PlanItem[]
}

type PasswordAudit = {
  strength: { score: number; label: 'weak' | 'moderate' | 'strong' }
  isPwned: boolean
  pwnedCount: number
  recommendation: string
  privacyNote: string
}

const FOCUS_SUGGESTIONS = [
  'Launch a side project',
  'Study for exam',
  'Get healthier',
  'Ship creative work',
  'Apply for jobs',
  'Improve productivity',
]

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8787'

function App() {
  const [input, setInput] = useState<UserInput>({
    name: '',
    city: '',
    focus: '',
    availableHours: 6,
    energy: 6,
  })
  const [weather, setWeather] = useState<WeatherInsight | null>(null)
  const [advice, setAdvice] = useState<string>('')
  const [timeline, setTimeline] = useState<PlanItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [auditPassword, setAuditPassword] = useState('')
  const [auditResult, setAuditResult] = useState<PasswordAudit | null>(null)
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditError, setAuditError] = useState('')

  const completionScore = useMemo(() => {
    const values = [input.name, input.city, input.focus]
    const filled = values.filter((value) => value.trim().length > 0).length
    return Math.round((filled / values.length) * 100)
  }, [input])

  const focusPlaceholder = FOCUS_SUGGESTIONS[0]

  async function generatePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch(`${API_BASE}/api/v1/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const data = (await response.json()) as PlanResponse | { error?: string }
      if (!response.ok) {
        throw new Error('error' in data ? (data.error ?? 'Plan API failed.') : 'Plan API failed.')
      }

      const planData = data as PlanResponse
      setWeather(planData.weather)
      setAdvice(planData.advice)
      setTimeline(planData.timeline)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected issue. Try again.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  async function runPasswordAudit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuditError('')
    setAuditLoading(true)
    setAuditResult(null)

    try {
      const response = await fetch(`${API_BASE}/api/v1/security/password-audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: auditPassword }),
      })
      const data = (await response.json()) as PasswordAudit | { error?: string }
      if (!response.ok) {
        throw new Error('error' in data ? (data.error ?? 'Password audit failed.') : 'Password audit failed.')
      }
      setAuditResult(data as PasswordAudit)
      setAuditPassword('')
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : 'Unexpected issue.')
    } finally {
      setAuditLoading(false)
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="kicker">SurpriseOS</p>
        <h1>Your AI command center with security-by-default.</h1>
        <p className="hero-copy">
          Plan your best day and audit your cyber hygiene in one place. The app now runs through
          a hardened backend with validation, rate limits, secure headers, and safer API boundaries.
        </p>
      </section>

      <section className="grid">
        <form className="panel form-panel" onSubmit={generatePlan}>
          <div className="panel-head">
            <h2>Quick setup</h2>
            <span className="badge">{completionScore}% ready</span>
          </div>

          <label>
            Your name
            <input
              value={input.name}
              onChange={(event) => setInput((current) => ({ ...current, name: event.target.value }))}
              placeholder="Alex"
              required
            />
          </label>

          <label>
            Your city
            <input
              value={input.city}
              onChange={(event) => setInput((current) => ({ ...current, city: event.target.value }))}
              placeholder="Manila"
              required
            />
          </label>

          <label>
            Top focus for today
            <input
              value={input.focus}
              onChange={(event) => setInput((current) => ({ ...current, focus: event.target.value }))}
              placeholder={focusPlaceholder}
              required
            />
          </label>

          <label>
            Available hours ({input.availableHours})
            <input
              type="range"
              min={2}
              max={12}
              step={1}
              value={input.availableHours}
              onChange={(event) =>
                setInput((current) => ({ ...current, availableHours: Number(event.target.value) }))
              }
            />
          </label>

          <label>
            Energy level ({input.energy}/10)
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={input.energy}
              onChange={(event) =>
                setInput((current) => ({ ...current, energy: Number(event.target.value) }))
              }
            />
          </label>

          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Building your system...' : 'Generate my best day'}
          </button>

          {error && <p className="error">{error}</p>}
        </form>

        <section className="panel insights-panel">
          <h2>Live insights</h2>
          {!weather ? (
            <p className="muted">Fill the form and generate to fetch weather and strategy signals.</p>
          ) : (
            <div className="stack">
              <article className="insight-card">
                <h3>Weather in {weather.locationName}</h3>
                <p className="big">{weather.temperature}°C</p>
                <p>
                  {weather.summary} · wind {weather.windSpeed} km/h
                </p>
                <p className="hint">{weather.hint}</p>
              </article>

              <article className="insight-card">
                <h3>Strategy advice</h3>
                <p>"{advice}"</p>
              </article>
            </div>
          )}
        </section>
      </section>

      <section className="panel timeline-panel">
        <div className="panel-head">
          <h2>{input.name ? `${input.name}'s execution timeline` : 'Execution timeline'}</h2>
          <span className="badge subtle">{timeline.length > 0 ? `${timeline.length} steps` : 'No plan yet'}</span>
        </div>
        {timeline.length === 0 ? (
          <p className="muted">
            Your timeline appears here with deep work blocks, reset breaks, and a review session.
          </p>
        ) : (
          <ol className="timeline">
            {timeline.map((item) => (
              <li key={`${item.time}-${item.title}`}>
                <time>{item.time}</time>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.details}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="panel security-panel">
        <div className="panel-head">
          <h2>Cybersecurity shield</h2>
          <span className="badge subtle">Live password breach audit</span>
        </div>
        <p className="muted">
          Check whether a password has appeared in known breaches using the Have I Been Pwned
          k-anonymity API. Only a hash prefix is sent, never the raw password.
        </p>
        <form className="security-form" onSubmit={runPasswordAudit}>
          <input
            type="password"
            value={auditPassword}
            onChange={(event) => setAuditPassword(event.target.value)}
            placeholder="Enter password to audit"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
          />
          <button type="submit" disabled={auditLoading}>
            {auditLoading ? 'Auditing securely...' : 'Run breach audit'}
          </button>
        </form>

        {auditError && <p className="error">{auditError}</p>}

        {auditResult && (
          <article className="insight-card">
            <h3>
              Result: {auditResult.isPwned ? 'Compromised in known breaches' : 'Not found in breach corpus'}
            </h3>
            <p>
              Strength: <strong>{auditResult.strength.label}</strong> ({auditResult.strength.score}/7)
            </p>
            <p>Breach count: {auditResult.pwnedCount.toLocaleString()}</p>
            <p>{auditResult.recommendation}</p>
            <p className="hint">{auditResult.privacyNote}</p>
          </article>
        )}
      </section>
    </main>
  )
}

export default App
