## Copilot / AI-agent instructies voor deze repository

Doel: snel en veilig nuttige codewijzigingen of fixes maken voor de Working Point inschrijvingen-app.

Kort overzicht
- React SPA (React 18) met HashRouter; routes en host-detectie zitten in `src/App.jsx`, `src/DomainRedirect.jsx`.
- Feature-first structuur: page-level components in `src/features/<domein>/pages/`, subcomponents in `components/`, hooks in `hooks/`.
- Data store: Supabase. Client wrapper: `src/lib/supabaseClient.js`. Veel features gebruiken hooks onder `src/features/**/hooks/` (bv. `useWedstrijden`).
- Serverless API endpoints lives in `/api/*.js` (Vercel-style). Belangrijke endpoints: `api/contact.js`, `api/notifyOrganisator.js`.

Belangrijke workflows & commands
- Start dev: `npm install` then `npm run dev`. Build: `npm run build`; Preview: `npm run preview`.
- Vite dev proxy in `vite.config.js` forward `/api` naar `http://localhost:3000` (gebruik `vercel dev` of een lokale server als je serverless endpoints nodig hebt).
- Repo bevat een nested edition `working-point-inschrijvingen/` met eigen `package.json` — controleer die map bij duplicatie van UI of API-implementaties.

Project-specifieke patterns (noem concrete voorbeelden)
- Supabase usage: look for `supabase.from("<table>")` in `src/features/**/pages/*.jsx` and hooks. Voor wedstrijden: `src/features/inschrijven/pages/hooks/useWedstrijden.js`.
- UI primitives: reuse controls in `src/ui/` (`button.jsx`, `input.jsx`, `card.jsx`). Nieuwe inputs should follow the simple prop patterns used there.
- Serverless email endpoints: `api/contact.js` and `api/notifyOrganisator.js` use a honeypot param `hp` and hide raw errors — test with `GET /api/contact?ping=1` to confirm endpoint availability.
- Query params & page state: several pages store UI state in query params (e.g. `wedstrijd_id`, `klasse`) — update helpers via `setQueryParam` where present to preserve URL state.

Integration points & common pitfalls
- Env vars required: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SMTP_* (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM). Missing vars cause silent failures in email flows.
- Proxy + serverless: when editing `/api/*` handlers, run a local server (or `vercel dev`) because Vite's dev server proxies to port 3000; otherwise API calls will 404.
- Permissions: Supabase row-level permissions may block queries in production; verify with the project's Supabase policies if queries unexpectedly return empty arrays.

How to make safe edits (contract for AI agents)
- Inputs: provide exact file paths to change, a short human intent, and any environment variables required to test locally.
- Outputs: small, targeted changes (single-file or a couple related files), a short verification step (run `npm run dev` and open the affected page), and a one-line test suggestion.
- Error handling: if a change depends on env vars or external services, note that the CI/dev environment may not be able to fully validate (mark such checks as manual).

Quick references (files to open first)
- `src/lib/supabaseClient.js` — supabase setup and use examples.
- `src/features/inschrijven/pages/hooks/useWedstrijden.js` — how wedstrijden are queried and shaped.
- `src/features/startlijst/pages/Startlijst.jsx` — currently the page that often needs fixes related to selecting wedstrijden and loading deelnemers.
- `api/contact.js`, `api/notifyOrganisator.js` — serverless email handlers and their ping endpoints.
- `vite.config.js`, `package.json` — dev proxy and scripts.

Als dit overzicht onduidelijk is of je wil dat ik iets specifieks toevoeg (bijv. een workflow voor 'apply patch via issue comment' of test-snippets voor Startlijst), geef dan aan welke sectie ik moet uitbreiden.
