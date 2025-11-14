# Configurazione Google Maps API

## Istruzioni per ottenere la chiave API di Google Maps

Per utilizzare l'autocomplete delle città è necessaria una chiave API di Google Maps con la libreria Places abilitata.

### Passaggi:

1. **Vai alla Google Cloud Console**
   - Apri [Google Cloud Console](https://console.cloud.google.com/)
   - Accedi con il tuo account Google

2. **Crea un nuovo progetto** (o usa uno esistente)
   - Clicca su "Select a project" → "New Project"
   - Dai un nome al progetto (es. "Singletrack App")
   - Clicca "Create"

3. **Abilita le API necessarie**
   - Nel menu laterale, vai su "APIs & Services" → "Library"
   - Cerca e abilita:
     - **Maps JavaScript API**
     - **Places API**

4. **Crea credenziali**
   - Vai su "APIs & Services" → "Credentials"
   - Clicca "Create Credentials" → "API Key"
   - Copia la chiave API generata

5. **Configura restrizioni (importante per sicurezza)**
   - Clicca sulla chiave appena creata
   - In "Application restrictions" seleziona "HTTP referrers"
   - Aggiungi i domini autorizzati:
     - `localhost:3000/*` (per sviluppo locale)
     - Il tuo dominio di produzione quando disponibile
   - In "API restrictions" seleziona "Restrict key" e scegli:
     - Maps JavaScript API
     - Places API

6. **Aggiungi la chiave al progetto**
   - Apri il file `public/index.html`
   - Trova la riga:
     ```html
     <script src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&libraries=places" async defer></script>
     ```
   - Sostituisci `YOUR_API_KEY` con la tua chiave API

### Esempio:
```html
<script src="https://maps.googleapis.com/maps/api/js?key=AIzaSyBdVl-cTICSwYKrZ95SuvNw7dbMuDt1KG0&libraries=places" async defer></script>
```

### Nota sui costi:
- Google Maps offre **$200 di credito gratuito al mese**
- L'autocomplete Places costa circa $2.83 per 1000 richieste
- Per un'app con traffico moderato, rimarrai probabilmente sotto il limite gratuito

### Variabili d'ambiente (opzionale, più sicuro):
Per maggiore sicurezza, puoi creare un file `.env` nella root del progetto:

```bash
REACT_APP_GOOGLE_MAPS_API_KEY=your_api_key_here
```

E modificare `public/index.html` per usare:
```html
<script src="https://maps.googleapis.com/maps/api/js?key=%REACT_APP_GOOGLE_MAPS_API_KEY%&libraries=places" async defer></script>
```

**Nota**: Con Create React App, le variabili d'ambiente in index.html richiedono un setup aggiuntivo. Per semplicità, usa direttamente la chiave nell'HTML durante lo sviluppo.
