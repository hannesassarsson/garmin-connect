# Coach OS

Personlig tränings-HUD mot IRONMAN 70.3 Jönköping 2027. Visar beredskap, sömn, HRV,
vilopuls, Body Battery, veckans belastning, alla pass och coachens rapporter
(passanalyser, morgon- och kvällskoll, planer).

## Så hänger det ihop

- Garmin-datan synkas till Supabase av `garmin-bridge`.
- Appen läser allt genom databasfunktionen `coach_feed(p_token)`. Tabellerna är låsta
  med RLS. Utan giltig åtkomstnyckel returneras ingenting.
- Nyckeln kommer första gången via länken (`/#k=...`) och sparas lokalt på enheten.
- Rapporter är rader i `public.coach_messages` (`kind`, `title`, `body_md` i Markdown,
  valfritt `activity_id` och `metrics` som JSON). En ny rad syns i appen inom en minut.

## Utveckling

```
npm install
npm run dev
```

Vercel: Root Directory `garmin-dashboard`, framework Vite.
