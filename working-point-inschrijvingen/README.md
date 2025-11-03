# Working Point Inschrijvingsapplicatie

Dit project is een React Single Page Application (SPA) die gebruikers in staat stelt zich in te schrijven voor evenementen. Het maakt gebruik van Supabase als primaire datastore en nodemailer voor e-mail notificaties.

## Projectstructuur

- **api/**: Bevat serverless functies voor het verwerken van contactformulieren en het notificeren van organisatoren.
  - `contact.js`: Behandelt inzendingen van het contactformulier en verstuurt e-mails.
  - `notifyOrganisator.js`: Notificeert de organisator na een succesvolle registratie.

- **src/**: Bevat de React-applicatie.
  - `main.jsx`: Het instappunt van de applicatie.
  - `App.jsx`: Definieert de hoofdcomponent en stelt routing in met HashRouter.
  - `DomainRedirect.jsx`: Behandelt de logica voor domeinredirectie.
  - **lib/**: Bevat de Supabase client en een wrapper voor de notificatie-API.
    - `supabaseClient.js`: Initialiseert de Supabase client.
    - `notifyOrganisator.js`: Wrapper voor de notifyOrganisator API.
  - **features/**: Bevat de verschillende functionaliteiten van de applicatie.
    - **inschrijven/**: Bevat pagina's, hooks en componenten voor inschrijvingen.
      - `pages/PublicInschrijven.jsx`: Behandelt gebruikersregistraties.
      - `hooks/useWedstrijden.js`: Haalt wedstrijden op uit de Supabase database.
      - `components/InschrijvingForm.jsx`: Component voor gebruikersinvoer tijdens registratie.
  - **ui/**: Bevat herbruikbare UI-componenten zoals knoppen, invoervelden en kaarten.

- **package.json**: Bevat projectmetadata, afhankelijkheden en scripts voor het bouwen en draaien van de applicatie.
- **vite.config.js**: Bevat de configuratie voor Vite, inclusief proxy-instellingen voor API-aanroepen.
- **.env.example**: Voorbeeld van de benodigde omgevingsvariabelen voor het project.

## Installatie

1. Clone de repository:
   ```
   git clone <repository-url>
   ```

2. Navigeer naar de projectdirectory:
   ```
   cd working-point-inschrijvingen
   ```

3. Installeer de afhankelijkheden:
   ```
   npm install
   ```

4. Start de ontwikkelserver:
   ```
   npm run dev
   ```

## Gebruik

- Bezoek de applicatie in uw browser op `http://localhost:3000`.
- Volg de instructies op de pagina's om u in te schrijven voor evenementen.

## Bijdragen

Bijdragen aan dit project zijn welkom! Voel je vrij om een pull request in te dienen of een issue te openen voor suggesties of problemen.

## Licentie

Dit project is gelicentieerd onder de MIT-licentie. Zie het LICENSE-bestand voor meer informatie.