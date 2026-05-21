import crypto from 'node:crypto'
import process from 'node:process'

import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { z } from 'zod'

dotenv.config()

const app = express()
const PORT = Number(process.env.PORT ?? 8787)
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'
const API_TIMEOUT_MS = 8000

const WEATHER_LABELS = {
  0: 'clear sky',
  1: 'mostly clear',
  2: 'partly cloudy',
  3: 'overcast',
  45: 'foggy',
  48: 'rime fog',
  51: 'light drizzle',
  53: 'drizzle',
  55: 'dense drizzle',
  61: 'light rain',
  63: 'rain',
  65: 'heavy rain',
  71: 'light snow',
  73: 'snow',
  75: 'heavy snow',
  80: 'rain showers',
  81: 'showers',
  82: 'heavy showers',
  95: 'thunderstorm',
  96: 'storm and hail',
  99: 'severe storm and hail',
}

app.disable('x-powered-by')
app.set('trust proxy', 1)

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'no-referrer' },
  }),
)
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || origin === CLIENT_ORIGIN) {
        callback(null, true)
        return
      }
      callback(new Error('Blocked by CORS policy'))
    },
    methods: ['GET', 'POST'],
    optionsSuccessStatus: 204,
  }),
)
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 160,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many requests. Please wait and retry.' },
  }),
)
app.use(express.json({ limit: '10kb' }))

app.use((req, res, next) => {
  const requestId = crypto.randomUUID()
  req.requestId = requestId
  res.setHeader('X-Request-ID', requestId)
  next()
})

const planSchema = z.object({
  name: z.string().trim().min(1).max(50),
  city: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[\p{L}\p{N}\s.'-]+$/u, 'City contains unsupported characters'),
  focus: z.string().trim().min(3).max(100),
  availableHours: z.number().int().min(2).max(12),
  energy: z.number().int().min(1).max(10),
})

const passwordSchema = z.object({
  password: z.string().min(8).max(128),
})

function weatherHint(code) {
  if ([61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code)) {
    return 'Move key tasks indoors and keep an umbrella nearby.'
  }
  if ([71, 73, 75].includes(code)) {
    return 'Batch errands and reserve extra travel time.'
  }
  if ([0, 1].includes(code)) {
    return 'Great day for one outdoor reset break.'
  }
  return 'Plan flex blocks so your day adapts smoothly.'
}

function buildTimeline(input, weatherCode) {
  const startHour = 8
  const workBlock = input.energy > 7 ? 75 : 55
  const microBreak = 10
  const blocks = Math.max(2, Math.round((input.availableHours * 60) / (workBlock + microBreak)))

  const items = []
  let totalMinutes = 0

  for (let i = 0; i < blocks; i += 1) {
    const currentMinutes = startHour * 60 + totalMinutes
    const hour = Math.floor(currentMinutes / 60)
    const minute = currentMinutes % 60
    const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    const isDeepWork = i % 2 === 0

    items.push({
      time,
      title: isDeepWork ? `Deep focus sprint ${Math.floor(i / 2) + 1}` : `Execution sprint ${Math.floor(i / 2) + 1}`,
      details: isDeepWork
        ? `Work only on "${input.focus}" with notifications off.`
        : 'Ship outputs: send messages, publish updates, or complete tasks.',
    })

    totalMinutes += workBlock
    if (i < blocks - 1) {
      const breakTotalMinutes = startHour * 60 + totalMinutes
      const breakHour = Math.floor(breakTotalMinutes / 60)
      const breakMinute = breakTotalMinutes % 60
      items.push({
        time: `${String(breakHour).padStart(2, '0')}:${String(breakMinute).padStart(2, '0')}`,
        title: 'Reset break',
        details: [0, 1, 2].includes(weatherCode)
          ? 'Take a short walk, hydrate, and avoid your phone.'
          : 'Stretch, hydrate, and do 2 minutes of breathing.',
      })
      totalMinutes += microBreak
    }
  }

  const endTotal = startHour * 60 + totalMinutes
  items.push({
    time: `${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`,
    title: 'Review and tomorrow setup',
    details: 'Capture wins, blockers, and the one priority for tomorrow.',
  })
  return items
}

async function safeJsonFetch(url) {
  const controller = AbortSignal.timeout(API_TIMEOUT_MS)
  const response = await fetch(url, { signal: controller })
  if (!response.ok) {
    throw new Error(`Upstream service error (${response.status})`)
  }
  return response.json()
}

async function getWeatherByCity(city) {
  const geocode = await safeJsonFetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`,
  )
  const location = geocode.results?.[0]
  if (!location) {
    throw new Error('City not found. Try a nearby major city.')
  }

  const weatherData = await safeJsonFetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,weather_code,wind_speed_10m`,
  )

  return {
    locationName: `${location.name}, ${location.country_code}`,
    temperature: Math.round(weatherData.current.temperature_2m),
    windSpeed: Math.round(weatherData.current.wind_speed_10m),
    weatherCode: weatherData.current.weather_code,
  }
}

async function getAdvice() {
  const advice = await safeJsonFetch('https://api.adviceslip.com/advice')
  return advice?.slip?.advice ?? 'Progress beats perfection.'
}

function getPasswordStrength(password) {
  let score = 0
  if (password.length >= 12) score += 2
  if (password.length >= 16) score += 1
  if (/[a-z]/.test(password)) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1

  const hasRepeated = /(.)\1{2,}/.test(password)
  const hasSequence = ['1234', 'abcd', 'qwerty', 'password'].some((part) =>
    password.toLowerCase().includes(part),
  )
  if (hasRepeated) score -= 1
  if (hasSequence) score -= 2

  const normalized = Math.max(0, Math.min(7, score))
  const label =
    normalized >= 6 ? 'strong' : normalized >= 4 ? 'moderate' : 'weak'
  return { score: normalized, label }
}

const passwordAuditLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 25,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Password audit limit reached. Retry later.' },
})

app.get('/api/v1/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'surpriseos-secure-api' })
})

app.post('/api/v1/plan', async (req, res) => {
  const parsed = planSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid request payload.',
      details: parsed.error.issues.map((issue) => issue.message),
    })
    return
  }

  try {
    const [weather, advice] = await Promise.all([
      getWeatherByCity(parsed.data.city),
      getAdvice(),
    ])
    const timeline = buildTimeline(parsed.data, weather.weatherCode)

    res.status(200).json({
      weather: {
        ...weather,
        summary: WEATHER_LABELS[weather.weatherCode] ?? 'conditions changing',
        hint: weatherHint(weather.weatherCode),
      },
      advice,
      timeline,
    })
  } catch (error) {
    res.status(502).json({
      error: 'Unable to generate plan right now. Please retry.',
      requestId: req.requestId,
    })
  }
})

app.post('/api/v1/security/password-audit', passwordAuditLimiter, async (req, res) => {
  const parsed = passwordSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Password must be 8-128 characters.' })
    return
  }

  try {
    const password = parsed.data.password
    const sha1 = crypto.createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase()
    const prefix = sha1.slice(0, 5)
    const suffix = sha1.slice(5)
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    })
    if (!response.ok) {
      throw new Error(`HIBP error (${response.status})`)
    }

    const text = await response.text()
    let pwnedCount = 0
    for (const line of text.split('\n')) {
      const [lineSuffix, count] = line.trim().split(':')
      if (lineSuffix === suffix) {
        pwnedCount = Number(count ?? '0')
        break
      }
    }

    const strength = getPasswordStrength(password)
    res.status(200).json({
      strength,
      isPwned: pwnedCount > 0,
      pwnedCount,
      recommendation:
        pwnedCount > 0 || strength.label !== 'strong'
          ? 'Use a unique 16+ character passphrase and store it in a password manager.'
          : 'Excellent. Keep this password unique and keep MFA enabled.',
      privacyNote:
        'Your raw password is never logged and only the first 5 SHA-1 hash chars are sent for breach lookup.',
    })
  } catch (_error) {
    res.status(502).json({
      error: 'Unable to audit password right now. Please retry later.',
      requestId: req.requestId,
    })
  }
})

app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' })
})

app.use((error, _req, res, _next) => {
  res.status(500).json({
    error: 'Unexpected server error.',
    requestId: _req.requestId,
  })
})

app.listen(PORT, () => {
  console.log(`SurpriseOS secure API listening on http://localhost:${PORT}`)
})
