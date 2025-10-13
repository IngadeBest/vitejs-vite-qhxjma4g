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