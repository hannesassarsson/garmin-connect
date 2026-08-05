# Garmin Dashboard

Personlig React-webapp för Forerunner 265 – översikt, sömn, återhämtning och AI-rekommendationer.

## Garmin-koppling (v0.2)

1. Öppna appen på Vercel
2. Gå till fliken **Mer**
3. Logga in med ditt Garmin-konto (e-post + lösenord)
4. Inloggningen sparas lokalt – du behöver bara göra det en gång
5. Tryck **Uppdatera** eller öppna appen igen för att hämta färsk data

**Obs:** Använder inofficiell Garmin Connect-metod (`python-garminconnect`). Kan gå sönder om Garmin ändrar autentisering.

## Vercel-inställningar

- **Root Directory**: `garmin-dashboard`
- **Framework**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- Python-beroenden installeras automatiskt via `requirements.txt`

## Teknik

- React 19 + TypeScript + Vite
- Tailwind (CDN)
- Vercel Serverless (Python) för Garmin-API
