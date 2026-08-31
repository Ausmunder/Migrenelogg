# Migrenelogg

En liten installerbar web-app (PWA) for å logge migreneanfall: når det startet, når det sluttet, hvor kraftig det var, og et valgfritt notat. Statistikkfanen viser nøkkeltall og to grafer.

Ingen byggesteg, ingen avhengigheter, ingen server. All data lagres lokalt i nettleseren på enheten.

## Kjøre lokalt

Service workers og ES-moduler krever et `http(s)`-opphav — å åpne `index.html` rett fra filsystemet fungerer ikke. Bruk den medfølgende serveren:

```bash
powershell -ExecutionPolicy Bypass -File tools\serve.ps1
```

Åpne så `http://localhost:8080/`. `Ctrl+C` stopper serveren. Annen port: `-Port 3000`.

Under utvikling cacher service workeren appen. Ser du gamle filer etter en endring, huk av **Update on reload** i DevTools → Application → Service Workers, eller øk `CACHE_NAME` i `sw.js`.

## Publisere og installere på iPhone

Appen må ligge på HTTPS for at «Legg til på Hjem-skjerm» skal gi en fullverdig app. Tre enkle alternativer:

**GitHub Pages**
1. Lag et nytt repo på github.com og push innholdet i denne mappa.
2. Settings → Pages → Source: `Deploy from a branch`, branch `main`, mappe `/ (root)`.
3. Etter et par minutter ligger appen på `https://<brukernavn>.github.io/<repo>/`.

**Netlify Drop** — gå til [app.netlify.com/drop](https://app.netlify.com/drop) og dra hele `migrenelogg`-mappa inn i nettleseren. Du får en HTTPS-adresse med én gang, uten konto.

**Cloudflare Pages** — Workers & Pages → Create → Pages → Upload assets, last opp mappa.

Deretter, på iPhone:
1. Åpne adressen i **Safari** (ikke Chrome — bare Safari kan legge til på hjemskjermen).
2. Trykk Del-knappen → **Legg til på Hjem-skjerm**.
3. Start appen fra ikonet. Den kjører i fullskjerm uten Safari-linje, og virker i flymodus.

## Om lagringen

Loggen ligger i `localStorage` på den enkelte enheten. Den synkroniseres ikke, og den følger ikke med til en ny telefon.

Under **Innstillinger → Sikkerhetskopi** kan du lagre eller dele en JSON-fil med hele loggen, og gjenopprette fra den senere. Import slår sammen: anfall som allerede finnes blir oppdatert, nye kommer i tillegg.

Safari sletter normalt nettsteders lagrede data etter sju dager uten bruk, men apper som er lagt til på hjemskjermen er unntatt fra dette. Sletter du nettleserdata eller fjerner appen, forsvinner loggen — derfor sikkerhetskopien.

## Filer

| Fil | Rolle |
| --- | --- |
| `index.html` | App-skall: tre faner og skjemaet for registrering |
| `css/app.css` | Utseende, lys/mørk modus, safe-area for iPhone |
| `js/store.js` | Lagring, validering og sikkerhetskopi |
| `js/format.js` | Norsk dato-, tid- og varighetsformatering |
| `js/charts.js` | SVG-søylediagrammer, tegnet for hånd |
| `js/app.js` | Visninger, navigasjon og skjemalogikk |
| `sw.js` | Service worker — gjør appen offline |
| `manifest.webmanifest` | Navn, ikoner og fullskjermmodus |
| `tools/serve.ps1` | Lokal utviklingsserver |
| `tools/make-icons.ps1` | Genererer ikonene i `icons/` på nytt |

Endrer du filer som skal caches, oppdater både `ASSETS` og `CACHE_NAME` i `sw.js`.

## Merk

Appen er et personlig loggverktøy, ikke medisinsk utstyr. Den stiller ingen diagnose og gir ingen behandlingsråd.
