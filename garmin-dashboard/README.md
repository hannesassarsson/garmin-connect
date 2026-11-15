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

## Vyer

- **Läge:** beredskap, nästa pass, sömn, HRV, vilopuls, Body Battery, veckans träning, senaste rapport, uppläst brief.
- **Plan:** 14 dagar med träningspass (`training.ics` i repot `-training-calendar`) och arbetspass (`work_schedule` i databasen).
- **Pass:** alla pass, med detaljvy: zoner, varv, bästa effekt och jämförelse mot liknande pass (`coach_activity`).
- **Trend:** formkurva (42/7 dagars snitt av Garmins träningsbelastning), timmar per vecka, intensitetsfördelning, utveckling per gren.
- **Mål:** säsongsplanens faser, tester och en grov prognos. Planen ligger i `coach_settings` (nyckel `season`).

## Notiser

En trigger på `coach_messages` anropar `/api/push` (Vercel-funktion) via `pg_net`. Funktionen skickar web push
till prenumerationerna i `coach_push_subs`. Hemligheterna `VAPID_PRIVATE_KEY` och `PUSH_SECRET` ligger som
miljövariabler i Vercel, och `PUSH_SECRET` även i `coach_private`. På iPhone fungerar notiser bara när appen
ligger på hemskärmen.

## Utveckling

```
npm install
npm run dev
```

Vercel: Root Directory `garmin-dashboard`, framework Vite.
