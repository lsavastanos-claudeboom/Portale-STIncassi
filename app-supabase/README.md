# Portale Incassi — Studi Riuniti e TecnAccise

Applicativo web per l'analisi delle proforma: incassi, tempi di incasso,
attività fatturate e comportamento di pagamento dei clienti.

I file Excel del gestionale vengono caricati dall'interfaccia, letti nel
browser e archiviati su Supabase, così l'analisi resta consultabile da più
persone senza ricaricare nulla.

## Sezionali

| Sezionale | Studio |
|-----------|--------------|
| C, P, D   | Studi Riuniti |
| T         | TecnAccise |

Il sezionale viene letto dal suffisso del numero documento (`860/C` → `C`).
Per aggiungerne altri basta modificare `SEZIONALI` in `src/lib/parse.js`.

## Cosa serve

- Node 18 o successivo
- Un progetto Supabase (piano gratuito sufficiente)

## Installazione

```bash
npm install
cp .env.example .env      # poi inserisci URL e anon key del progetto
npm run dev
```

### Supabase

1. Crea un progetto su https://supabase.com
2. Apri **SQL Editor** e incolla per intero `supabase/schema.sql`, poi esegui
3. In **Project Settings → API** copia *Project URL* e *anon public key* dentro `.env`
4. Avvia l'app e registra il primo account: diventa automaticamente amministratore
5. Gli account successivi entrano in sola lettura; per promuoverli, in
   **Table Editor → membri** cambia `ruolo` da `lettore` ad `admin`
6. Quando il gruppo è al completo, in **Authentication → Providers → Email**
   disattiva le registrazioni aperte

Solo gli amministratori possono importare o cancellare dati. Le policy RLS
sono definite in `schema.sql`: senza un record in `membri` non si legge nulla.

## Pubblicazione

Il build è statico, quindi va bene qualsiasi hosting:

```bash
npm run build     # genera dist/
```

Su Vercel o Netlify collega il repository, imposta `npm run build` come comando
e `dist` come cartella di output, e aggiungi le due variabili d'ambiente
`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

## Come sono calcolati i dati

- **Tempo medio di incasso (DSO ponderato)** — media dei giorni fra data
  documento e data incasso, pesata sull'imponibile di ciascun documento. Gli
  incassi anticipati, tipici degli addebiti RID, valgono zero giorni e non
  giorni negativi.
- **Curva di incasso** — ogni anno è misurato sulla stessa coorte di documenti
  maturi, così l'anno in corso non risulta penalizzato dalle fatture troppo
  recenti per essere giudicate.
- **Confronto fra esercizi** — di norma su finestra omogenea (1 gennaio →
  stessa data nei due anni). Il confronto sugli anni interi resta disponibile.
- **Ripartizione delle attività** — sui soli valori positivi delle colonne di
  dettaglio: le voci negative sono storni e sconti, e falserebbero la
  composizione del fatturato.
- **Punteggio cliente** — velocità di pagamento (45%), quota di fatturato
  ancora aperta (35%), anzianità della posizione più vecchia (20%).
- **Data di riferimento** — la più recente presente in archivio, non la data
  odierna: su un archivio non aggiornato "oggi" gonfierebbe lo scaduto.

## Import senza duplicati

L'upsert avviene su `(studio, sezionale, n_doc, data_doc)`. Ricaricare lo
stesso periodo aggiorna le date di incasso dei documenti già presenti invece
di duplicarli.
