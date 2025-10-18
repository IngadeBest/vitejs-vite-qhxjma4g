# Project refactor (feature-based)

Belangrijkste wijzigingen:
- Grote pagina's zijn verplaatst naar `src/features/<domein>/pages/`.
- Subcomponenten staan in `src/features/<domein>/components/`.
- Supabase client staat in `src/lib/supabaseClient.js`.
- App routes importeren nu pagina's uit de features-mappen.

## Mappenstructuur
- src/
  - features/
    - ruiters/
      - pages/RuiterInvoer.jsx
    - proeven/
      - pages/ProefInstellingen.jsx
    - scoring/
      - pages/ScoreInvoer.jsx
      - components/ScoreTabs.jsx
    - einduitslag/
      - pages/Einduitslag.jsx
    - wedstrijd/
      - pages/WedstrijdDashboard.jsx
  - lib/
    - supabaseClient.js
  - ui/
    - button.jsx, input.jsx, card.jsx
  - App.jsx
  - main.jsx
  - index.css

## Na het verplaatsen
- `App.jsx` imports aangepast.
- In de pagina's zijn imports naar `./supabaseClient` vervangen door `../../lib/supabaseClient`.
- In `ScoreInvoer.jsx` is de import naar `ScoreTabs` aangepast naar `../components/ScoreTabs`.

## Te verwijderen (oude locaties)
- `src/ScoreInvoer.jsx`
- `src/ScoreTabs.jsx`
- `src/RuiterInvoer.jsx`
- `src/ProefInstellingen.jsx`
- `src/Einduitslag.jsx`
- `src/WedstrijdDashboard.jsx`
- `src/supabaseClient.js` (nu `src/lib/supabaseClient.js`)

## Database migrations

De repository bevat eenvoudige SQL-migraties in de map `migrations/`. Migraties worden lexicografisch toegepast door het helper-script of via de CI-workflow.

Local (psql)
1. Zorg dat `psql` is geïnstalleerd en dat `DATABASE_URL` is ingesteld:

```bash
export DATABASE_URL="postgres://user:pass@host:5432/dbname"
```

2. Run het migratie-helper script:

```bash
chmod +x ./scripts/run_migrations.sh
./scripts/run_migrations.sh
```

GitHub Actions

Voeg een repository secret toe met de naam `DATABASE_URL` en trigger de workflow handmatig of push naar `main`. De workflow (`.github/workflows/run-migrations.yml`) zet `psql` op en roept hetzelfde script aan.

Security notes
- Houd `DATABASE_URL` als repository secret — commit nooit credentials in source control.
- Review migratiefiles voordat je de workflow uitvoert; de workflow voert SQL direct op de database uit.
