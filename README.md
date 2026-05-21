# SurpriseOS (Security-First Upgrade)

SurpriseOS is a full-stack AI planning and cyber hygiene app built with React + TypeScript + Node.js.

It generates practical daily execution plans and now includes a password breach audit with privacy-preserving checks.

## Core features

- Guided planning flow (goal, city, hours, energy)
- Live insights from external APIs
- Smart timeline generation for deep work and recovery blocks
- Cybersecurity shield with breach + strength audit
- Responsive UX designed for non-technical users

## Security architecture

- Dedicated backend API (no third-party API calls directly from the browser)
- Request validation with strict schemas (`zod`)
- Security headers via `helmet`
- CORS locked to configured client origin
- Global and endpoint-specific rate limiting
- Body size limits to reduce abuse surface
- Request IDs for safer incident tracing
- Password audit uses HIBP k-anonymity model (hash prefix only)
- No raw password logging

## APIs used

- Open-Meteo Geocoding API: `https://geocoding-api.open-meteo.com`
- Open-Meteo Forecast API: `https://api.open-meteo.com`
- Advice Slip API: `https://api.adviceslip.com`
- Have I Been Pwned Pwned Passwords API: `https://api.pwnedpasswords.com`

## Local setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create your env file by duplicating `.env.example` as `.env`.
3. Run frontend + backend together:
   ```bash
   npm run dev:full
   ```

## Scripts

- `npm run dev` - frontend only
- `npm run dev:api` - secure backend API only
- `npm run dev:full` - both frontend and backend
- `npm run lint` - lint checks
- `npm run build` - production build (frontend)
