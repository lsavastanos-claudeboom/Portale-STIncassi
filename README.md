# Portale Incassi — Studi Riuniti e TecnAccise

Analisi delle proforma di studio: incassi, tempi di incasso, attività
fatturate e comportamento di pagamento dei clienti.

Il repository contiene due versioni della stessa applicazione.

| Cartella | Cosa è | Quando usarla |
|----------|--------|---------------|
| `index.html` | Applicazione in un unico file, senza installazione | Uso quotidiano da una sola postazione |
| `app-supabase/` | Versione React con accesso, ruoli e archivio condiviso | Più persone che consultano gli stessi dati |

---

## Versione in un file — `index.html`

Si apre con un doppio clic, oppure si pubblica su GitHub Pages e diventa
raggiungibile da un indirizzo web. Gli export Excel si trascinano dentro la
pagina: vengono letti nel browser e restano sul computer, senza passare da
alcun server. L'archivio viene conservato in locale, quindi alla riapertura i
dati sono già lì.

Servono solo due librerie da CDN (SheetJS e Chart.js), quindi al primo
caricamento occorre la connessione.

### Pubblicarla su GitHub Pages

Dalle impostazioni del repository: **Settings → Pages → Source: Deploy from a
branch → Branch: main / (root) → Save**. Dopo un paio di minuti l'app è
online all'indirizzo `https://<utente>.github.io/<repository>/`.

Se il repository è pubblico, l'indirizzo è raggiungibile da chiunque lo
conosca. I dati dei clienti però non finiscono online: restano nel browser di
chi apre la pagina. Se preferisci che nemmeno l'applicazione sia pubblica,
tieni il repository privato e usa il file in locale.

---

## Versione con accesso — `app-supabase/`

React e Vite per l'interfaccia, Supabase per autenticazione e archivio.
I dati vengono importati una volta e restano consultabili da tutti gli
utenti abilitati.

Istruzioni complete in [`app-supabase/README.md`](app-supabase/README.md).
In sintesi:

```bash
cd app-supabase
npm install
cp .env.example .env      # URL e anon key del progetto Supabase
npm run dev
```

Poi si esegue `app-supabase/supabase/schema.sql` nel SQL Editor di Supabase.
Il primo account registrato diventa amministratore; gli altri entrano in
sola lettura finché non vengono promossi.

---

## Sezionali

| Sezionale | Studio |
|-----------|--------------|
| C, P, D | Studi Riuniti |
| T | TecnAccise |

Il sezionale si ricava dal suffisso del numero documento (`860/C` → `C`).
Per aggiungerne altri si modifica `SEZIONALI`, presente sia in `index.html`
sia in `app-supabase/src/lib/parse.js`.

## Formato dell'export

L'applicazione riconosce l'intestazione da sola, purché siano presenti almeno
le colonne `N. DOC` e `IMPONIBILE`. Le altre colonne anagrafiche riconosciute
sono `CATEGORIA`, `DATA DOC.`, `DATA INCASSO`, `CLIENTE`, `CASSA 4%`,
`IVA 22%`, `QUANTITÀ`, `TOTALE`, `INTERMEDIARIO` e `DATA EXPORT XML`.
Tutto ciò che segue è trattato come dettaglio delle attività fatturate.

L'importazione avviene in *upsert* sulla combinazione
`studio · sezionale · numero documento · data`: ricaricare lo stesso periodo
aggiorna le date di incasso invece di duplicare le righe.

## Come sono calcolati i dati

- **Tempo medio di incasso (DSO ponderato)** — media dei giorni fra data
  documento e data incasso, pesata sull'imponibile di ciascun documento. Gli
  incassi anticipati, tipici degli addebiti RID, valgono zero giorni e non
  giorni negativi: contarli come negativi abbasserebbe il dato in modo
  fittizio.
- **Curva di incasso** — tutti gli anni sono misurati sulla stessa coorte di
  documenti maturi. Senza questo accorgimento l'anno in corso sembrerebbe
  sempre peggiore, perché le fatture più recenti risulterebbero non pagate
  solo per mancanza di tempo.
- **Confronto fra esercizi** — di norma su finestra omogenea, dal 1° gennaio
  alla stessa data nei due anni. Il confronto sugli anni interi resta
  disponibile ma va letto sapendo che l'anno in corso è incompleto.
- **Ripartizione delle attività** — calcolata sui soli valori positivi delle
  colonne di dettaglio: le voci negative sono storni e sconti, e falserebbero
  la composizione del fatturato.
- **Punteggio cliente (0–100)** — velocità di pagamento (45%), quota di
  fatturato ancora aperta (35%), anzianità della posizione più vecchia (20%).
  La divergenza fra media ponderata e mediana distingue il ritardatario
  abituale da chi ha una sola pratica ferma.
- **Data di riferimento** — la più recente presente in archivio, non la data
  odierna: su un archivio non aggiornato "oggi" gonfierebbe lo scaduto.
