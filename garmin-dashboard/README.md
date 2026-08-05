# Garmin Dashboard

Personlig React-webapp för Forerunner 265 – översikt, sömn, återhämtning och AI-rekommendationer.

## Deploya till Vercel (rekommenderat)

### Alternativ 1 – Enklast (via GitHub)

1. Skapa ett nytt repo på GitHub och ladda upp hela `garmin-dashboard`-mappen.
2. Gå till [vercel.com](https://vercel.com) och logga in (med GitHub).
3. Klicka **Add New Project** → importera ditt repo.
4. Vercel upptäcker Vite automatiskt. Klicka **Deploy**.
5. Klart! Du får en URL typ `https://garmin-dashboard-xxx.vercel.app`

### Alternativ 2 – Vercel CLI (om du kan köra kommandon någonstans)

```bash
npm i -g vercel
cd garmin-dashboard
vercel
```

Följ stegen (logga in, etc.).

## Lokalt (om du får möjlighet)

```bash
npm install
npm run dev
```

## Vad som finns i MVP

- **Idag**: "Hur mår jag idag?" + Body Battery + AI-rekommendationer
- **Sömn**: Sömnpoäng + stadier + återhämtning
- **Aktivitet**: Senaste pass (mock)
- **Mer**: Inställningar

Nästa steg: koppla inofficiell Garmin-login + riktig data.
