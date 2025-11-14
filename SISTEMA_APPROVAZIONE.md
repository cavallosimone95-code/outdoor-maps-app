# Sistema di Approvazione Contenuti e Utenti

## Panoramica

Il sistema implementa due tipi di utenti con permessi differenti e richiede l'approvazione sia per i nuovi utenti che per i contenuti creati.

### 1. **Utente Standard** (ruolo: `standard`)
- **Registrazione**: Tutti i nuovi utenti vengono registrati come "standard"
- **Approvazione account**: NON possono accedere all'app fino all'approvazione da parte di un Developer
- **Processo registrazione**:
  1. L'utente compila il form di registrazione
  2. Riceve messaggio: *"Registrazione completata! In attesa di approvazione da parte di un amministratore."*
  3. Non può effettuare il login fino all'approvazione
  4. Se prova a fare login: *"Il tuo account è in attesa di approvazione da parte di un amministratore."*
- **Creazione contenuti** (dopo approvazione):
  - Può creare tracce e POI
  - I contenuti NON appaiono immediatamente sulla mappa
  - Necessaria approvazione da parte di un Developer

### 2. **Utente Developer** (ruolo: `developer`)
- **Account predefinito**: 
  - Email: `admin@singletrack.app`
  - Password: `admin123`
  - Username: `admin`
- **Accesso immediato**: Account già approvato
- **Creazione contenuti**: Può creare tracce e POI che appaiono immediatamente
- **Pannello Approvazione**: Ha accesso a un menu speciale "✅ Approvazioni"
- **Permessi**:
  - Approva o rifiuta nuovi utenti
  - Approva o rifiuta tracce e POI degli utenti standard
  - Badge "DEV" visibile nel profilo

## Come Funziona

### Flusso Nuovo Utente

1. **Registrazione** su http://localhost:3000
2. Compila il form con:
   - Email
   - Username
   - Nome e Cognome
   - Data di nascita (minimo 13 anni)
   - Password e conferma
3. Riceve conferma registrazione con messaggio di attesa
4. Viene reindirizzato alla pagina di login
5. **NON PUÒ** accedere fino all'approvazione dell'admin
6. Se prova a fare login → messaggio "in attesa di approvazione"

### Flusso Developer - Approvazione Utenti

1. **Login** come developer (`admin@singletrack.app` / `admin123`)
2. Clicca su **"✅ Approvazioni"** nel menu laterale
3. Seleziona tab **"Utenti"** (numero in attesa tra parentesi)
4. Per ogni utente in attesa vedi:
   - Nome completo
   - Username ed email
   - Data di registrazione
   - Data di nascita
5. Azioni disponibili:
   - **✅ Approva**: L'utente può accedere all'app
   - **❌ Rifiuta**: L'account viene eliminato definitivamente

## Storage dei Dati

### localStorage Keys

- `singletrack_users`: Tutti gli utenti (approvati e non approvati)
- `singletrack_current_user`: Utente corrente loggato
- `singletrack_pending_tracks`: Tracce in attesa di approvazione
- `singletrack_pending_pois`: POI in attesa di approvazione
- `singletrack_tracks`: Tracce approvate (visibili sulla mappa)
- `singletrack_pois`: POI approvati (visibili sulla mappa)

### Struttura Dati

#### User
```typescript
{
  id: string,
  email: string,
  username: string,
  firstName: string,
  lastName: string,
  birthDate: string,
  password: string,
  role: 'standard' | 'developer',
  approved: boolean,      // false finché admin non approva
  createdAt: string
}
```

#### CurrentUser
```typescript
{
  id: string,
  email: string,
  username: string,
  firstName: string,
  lastName: string,
  birthDate: string,
  role: 'standard' | 'developer',
  approved: boolean
}
```

#### PendingTrack
```typescript
{
  id: string,
  name: string,
  description: string,
  difficulty: string,
  length: number,
  points: Array<{lat, lng}>,
  userId: string,        // ID dell'autore
  userName: string,      // Nome completo autore
  submittedAt: string,   // Timestamp invio
  createdBy: string,     // ID utente
  approved: false        // Sempre false per pending
}
```

#### PendingPOI
```typescript
{
  id: string,
  name: string,
  description: string,
  type: string,          // bikeshop, restaurant, etc.
  location: {lat, lng},
  userId: string,        // ID dell'autore
  userName: string,      // Nome completo autore
  submittedAt: string,   // Timestamp invio
  createdBy: string,     // ID utente
  approved: false        // Sempre false per pending
}
```

## Funzioni API

### authService.ts

```typescript
// Gestione utenti in attesa
getPendingUsers(): User[]              // Utenti con approved=false
approveUser(userId: string): void      // Imposta approved=true
rejectUser(userId: string): void       // Elimina utente dal sistema

// Elenchi utenti
getApprovedUsers(): User[]             // Utenti standard approvati
getDevelopers(): User[]                // Utenti con ruolo 'developer'

// Registrazione e login
register(userData): { success, message } // Crea utente con approved=false
login(email, password): { success, message, user } // Blocca se !approved

// Inizializzazione
initializeDefaultAccounts(): void      // Crea admin se non esiste
```

### trackStorage.ts

```typescript
// Gestione contenuti in attesa
getPendingTracks(): PendingTrack[]
savePendingTracks(tracks: PendingTrack[]): void
getPendingPOIs(): PendingPOI[]
savePendingPOIs(pois: PendingPOI[]): void

// Approvazione/Rifiuto
approveTrack(trackId: string): void    // Sposta da pending a approved
rejectTrack(trackId: string): void     // Elimina da pending
approvePOI(poiId: string): void        // Sposta da pending a approved
rejectPOI(poiId: string): void         // Elimina da pending
```

### authService.ts

```typescript
// Inizializzazione account developer
initializeDefaultAccounts(): void      // Crea admin se non esiste

// Gestione ruoli
UserRole = 'standard' | 'developer'
User.role: UserRole
CurrentUser.role: UserRole
```

## Eventi Custom

Il sistema utilizza eventi per sincronizzare UI e mappa:

- `tracks:updated`: Emesso dopo approvazione/rifiuto traccia
- `pois:updated`: Emesso dopo approvazione/rifiuto POI
- `tracks:refresh`: Trigger per ricaricare le tracce sulla mappa
- `pois:refresh`: Trigger per ricaricare i POI sulla mappa

## UI/UX

### Badge Utente Developer
- Appare accanto al nome utente nella sidebar
- Colore: Gradiente viola (#667eea → #764ba2)
- Testo: "DEV" in maiuscolo

### Pannello Approvazione
- Visibile solo per developer
- **Tab separati**: Utenti (in attesa), Utenti Attivi, Sviluppatori, Tracce, POI
- Contatore elementi per ciascun tab
- Card per ogni elemento con:
  - **Utenti**: Nome completo, username, email, data registrazione, data nascita
  - **Tracce**: Titolo, descrizione, autore, data invio, difficoltà/lunghezza
  - **POI**: Titolo, descrizione, autore, data invio, tipo/posizione
  - Bottoni Approva (verde) e Rifiuta (rosso)

#### Elenco Sviluppatori
- Tab dedicato "Sviluppatori" con lista degli utenti con ruolo `developer`
- Mostra: nome, username, email, data creazione, badge "🛠️ Sviluppatore" e stato approvazione
- Attualmente solo consultazione (nessuna azione di demozione prevista)

### Notifiche
- **Registrazione**: "Registrazione completata! In attesa di approvazione..."
- **Login non approvato**: "Il tuo account è in attesa di approvazione..."
- **Standard user (contenuto)**: "Inviato per approvazione..."
- **Developer (contenuto)**: "Creato con successo!" (immediato)

## Test del Sistema

### Come Testare

1. **Registra un nuovo utente**
   - Vai su http://localhost:3000
   - Clicca "Registrati"
   - Compila il form completo
   - Ricevi messaggio di attesa approvazione

2. **Prova login come utente non approvato**
   - Prova a fare login con le credenziali appena create
   - Verifica messaggio "in attesa di approvazione"
   - Conferma che NON puoi accedere

3. **Login come developer**
   - Login con `admin@singletrack.app` / `admin123`
   - Verifica badge "DEV" nel profilo

4. **Approva nuovo utente**
   - Clicca "✅ Approvazioni"
   - Seleziona tab "Utenti (1)" 
   - Vedi card con info utente in attesa
   - Clicca "✅ Approva"
   - Conferma approvazione

5. **Login come utente approvato**
   - Logout dall'admin
   - Login con utente standard appena approvato
   - Verifica accesso riuscito all'app

6. **Crea contenuto come standard**
   - Crea una traccia o POI
   - Verifica messaggio "inviato per approvazione"
   - Verifica che NON appare sulla mappa

7. **Approva contenuto**
   - Login come developer
   - Clicca "✅ Approvazioni"
   - Vai su tab "Tracce" o "POI"
   - Approva il contenuto
   - Verifica che appare sulla mappa

8. **Rifiuta utente**
   - Registra nuovo utente
   - Login come developer
   - Vai su "Approvazioni" → "Utenti"
   - Clicca "❌ Rifiuta"
   - Conferma eliminazione
   - Verifica che l'utente non può più fare login

## Note di Sicurezza

⚠️ **IMPORTANTE**: Questo è un sistema di sviluppo/prototipo

- Password in chiaro nel localStorage
- Nessuna autenticazione backend
- Nessuna validazione server-side
- Account admin con password hardcoded

### Per Produzione:
1. Implementare backend con autenticazione JWT
2. Hash delle password (bcrypt)
3. Validazione input server-side
4. Rate limiting
5. HTTPS obbligatorio
6. Gestione ruoli lato server
7. Audit log delle approvazioni

## Workflow Completo

### Nuovo Utente
```
┌─────────────┐
│  Registra   │
│   account   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  approved = │
│    false    │
└──────┬──────┘
       │
       ├─ Prova login ────┐
       │                  │
       │                  ▼
       │          ┌──────────────┐
       │          │  Messaggio:  │
       │          │ "in attesa"  │
       │          └──────────────┘
       │
       ▼
┌─────────────┐
│  Developer  │
│ approva/    │
│  rifiuta    │
└──────┬──────┘
       │
       ├─ Approva? ────┐
       │                │
       │                ▼
       │        ┌──────────────┐
       │        │ approved =   │
       │        │    true      │
       │        │ → può loggare│
       │        └──────────────┘
       │
       ├─ Rifiuta? ────┐
       │                │
       │                ▼
       │        ┌──────────────┐
       │        │   Account    │
       │        │  eliminato   │
       │        └──────────────┘
       │
       ▼
   (In attesa)
```

### Contenuti Utente Standard
```
┌─────────────┐
│ Utente crea │
│  contenuto  │
└──────┬──────┘
       │
       ├─ Developer? ──────┐
       │                   │
       │                   ▼
       │           ┌──────────────┐
       │           │ Salva diretto│
       │           │  in approved │
       │           └──────────────┘
       │
       ▼
┌─────────────┐
│ Salva come  │
│   pending   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Developer  │
│  apre panel │
└──────┬──────┘
       │
       ├─ Approva? ────┐
       │                │
       │                ▼
       │        ┌──────────────┐
       │        │ Sposta in    │
       │        │  approved +  │
       │        │ mostra mappa │
       │        └──────────────┘
       │
       ├─ Rifiuta? ────┐
       │                │
       │                ▼
       │        ┌──────────────┐
       │        │  Elimina da  │
       │        │   pending    │
       │        └──────────────┘
       │
       ▼
   (In attesa)
```

## Personalizzazione

### Cambiare Credenziali Admin

Modifica `authService.ts`:

```typescript
const devUser: User = {
    id: 'dev_001',
    email: 'tua-email@domain.com',
    username: 'tuo-username',
    firstName: 'Nome',
    lastName: 'Cognome',
    birthDate: '1990-01-01',
    password: 'tua-password-sicura',
    role: 'developer',
    createdAt: new Date().toISOString()
};
```

### Aggiungere Nuovi Ruoli

1. Modifica `UserRole` in `authService.ts`:
```typescript
export type UserRole = 'standard' | 'developer' | 'moderator';
```

2. Implementa logica specifica nel codice:
```typescript
if (currentUser?.role === 'moderator') {
    // Permessi specifici moderatore
}
```

### Auto-approvazione Parziale

Modifica `trackStorage.ts` per auto-approvare certi tipi:

```typescript
// Auto-approve POI di tipo "fountain"
if (poi.type === 'fountain') {
    newPOI.approved = true;
    // Salva direttamente...
}
```

## Troubleshooting

### I contenuti non appaiono dopo approvazione
- Controlla console browser per errori
- Verifica che `tracks:refresh` / `pois:refresh` eventi siano emessi
- Ricarica la pagina

### Pannello Approvazione non visibile
- Verifica di essere loggato come developer
- Controlla `currentUser.role === 'developer'`
- Ricarica localStorage: `localStorage.clear()` e re-login

### Contenuti duplicati
- Controlla che `approved: true` sia settato correttamente
- Verifica filtri in `getTracks()` / `getCustomPOIs()`

## Conclusione

Il sistema di approvazione è ora completamente funzionale:
- ✅ Due ruoli utente (standard/developer)
- ✅ **Approvazione obbligatoria per nuovi utenti**
- ✅ Utenti non approvati non possono accedere all'app
- ✅ Contenuti pending per utenti standard
- ✅ Pannello approvazione con tab: Utenti, Utenti Attivi, Sviluppatori, Tracce, POI
- ✅ Auto-approvazione per developer
- ✅ Account admin predefinito
- ✅ UI/UX completa con notifiche

**Priorità approvazioni**: Si consiglia di approvare prima gli utenti, poi i loro contenuti.

Per domande o problemi, consulta i file:
- `/src/services/authService.ts` - Gestione utenti e ruoli
- `/src/services/trackStorage.ts` - Logica approvazione contenuti
- `/src/components/ApprovalPanel.tsx` - UI approvazione (3 tab)
- `/src/components/Sidebar.tsx` - Integrazione menu
- `/src/components/RegisterForm.tsx` - Gestione registrazione
