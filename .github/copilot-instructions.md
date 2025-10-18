## Copilot / AI-agent instructies voor deze repository

Doel: snel nuttige codewijzigingen of fixes maken voor de Working Point inschrijvingsapplicatie.

- Grote lijnen
  - React SPA (React 18) met HashRouter: routes gedefinieerd in `src/App.jsx` (publiek vs beheer via hostname `app.*`).
  - Feature-based mapstructuur: pagina's leven in `src/features/<domein>/pages/` (bijv. `inschrijven`, `startlijst`, `protocollen`).
  - Supabase is de primaire datastore. Client: `src/lib/supabaseClient.js` (vite env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY). Session persistence is uitgeschakeld.
  - Serverless functies bestaan in `/api/*.js` (vercel-style). Belangrijke endpoints: `api/contact.js` en `api/notifyOrganisator.js` — beide gebruiken `nodemailer` en bieden een healthcheck via `?ping`.
  - Vite dev proxy: `vite.config.js` proxyt `/api` naar `http://localhost:3000` (vercel dev). Project gebruikt alias `@` -> `/src`.

- Typische datastromen & voorbeelden
  - PublicInschrijven -> schrijft naar Supabase table `inschrijvingen` met `supabase.from("inschrijvingen").insert(payload)` (`src/features/inschrijven/pages/PublicInschrijven.jsx`).
  - Notificatie: na insert wordt `notifyOrganisator` aangeroepen (client wrapper onder `src/lib/notifyOrganisator` of fallback naar `/api/notifyOrganisator.js`).
  - Wedstrijden ophalen: `useWedstrijden` hook gebruikt `supabase.from("wedstrijden").select("*").order("datum")` (`src/features/inschrijven/pages/hooks/useWedstrijden.js`).

- Conventies & belangrijke patronen
  - Feature folders: grote, page-level components naar `src/features/<domein>/pages/`. Subcomponenten naar `src/features/<domein>/components/`.
  - UI primitives in `src/ui/` (button, input, card) — voorkom duplicate styling, hergebruik deze.
  - E-mail endpoints gebruiken een eenvoudige honeypot (`hp`) en verbergen fouten: test met `GET /api/contact?ping=1` of `GET /api/notifyOrganisator?ping=1`.
  - Server-side code (in `api/`) mag nodemailer gebruiken; check environment variabelen: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, ORGANISATOR_EMAIL_DEFAULT.

- Dev / build / deploy hints
  - Install & run: `npm install` then `npm run dev`. Build: `npm run build` and preview: `npm run preview`.
  - Zorg dat `.env` (lokale Vite env) bevat: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, plus SMTP_* en OPTIONAL `ORGANISATOR_EMAIL_DEFAULT` / `RESEND_API_KEY` als relevant.
  - Vercel: zet these same vars in project settings; serverless functies draaien op Vercel (dev-proxy verwacht ze op poort 3000).

- Quick navigation (waar te kijken voor veelvoorkomende taken)
  - Waar Supabase-queries staan: `src/lib/supabaseClient.js`, `src/features/**/pages/*.jsx`, `src/features/**/hooks/*.js`.
  - API / e-mail logica: `api/contact.js`, `api/notifyOrganisator.js`.
  - Routing & host-detectie: `src/App.jsx` en `src/DomainRedirect.jsx`.
  - Build / dev entry: `package.json` scripts and `vite.config.js` (proxy + alias).

- Small contract for changes made by AI agents
  - Inputs: path(s) to edit within `src/` or `api/`, a short human description of the goal, and any new env vars required.
  - Outputs: minimal, targeted code edits, updated tests or sanity checks where safe, and a short verification (build or linter run).
  - Error modes to note: missing env vars (email fails), Supabase permission errors, and network errors to `/api` when not running vercel dev.

Als iets onduidelijk of incompleet is (bijv. ontbrekende env-variabelen of onduidelijke behaviour in een page), zeg wat je nodig hebt en ik pas de instructies aan.
