# Come mettere questo progetto su GitHub

Due strade. La prima non richiede di installare nulla.

---

## A · Dal browser, trascinando la cartella (circa due minuti)

1. Estrai lo zip: ottieni la cartella `portale-incassi`.
2. Vai su **https://github.com/new**.
   - *Repository name*: `portale-incassi`
   - Scegli **Private** se preferisci che non sia visibile a tutti
   - **Non** spuntare "Add a README file": il repository deve restare vuoto
   - Premi **Create repository**
3. Nella pagina che appare, fai clic su **uploading an existing file**
   (il collegamento nella riga "…or upload an existing file").
4. **Trascina il contenuto** della cartella `portale-incassi` nell'area di
   caricamento — cioè `index.html`, `README.md`, `.gitignore` e la cartella
   `app-supabase`. Trascina i file e la cartella, non la cartella esterna,
   altrimenti ti ritrovi tutto dentro un livello in più.
5. In basso scrivi un messaggio, per esempio `primo caricamento`, e premi
   **Commit changes**.

Fatto.

### Per renderla raggiungibile da un indirizzo web

**Settings → Pages → Source: Deploy from a branch → Branch: `main` / `(root)`
→ Save.** Dopo un paio di minuti l'app risponde su
`https://<tuo-utente>.github.io/portale-incassi/`.

Attenzione a una cosa: se il repository è pubblico, quell'indirizzo è
raggiungibile da chiunque. I dati dei clienti non ci finiscono comunque —
restano nel browser di chi apre la pagina — ma se preferisci che nemmeno
l'applicazione sia esposta, tieni il repository privato e apri il file in
locale con un doppio clic. Funziona allo stesso modo.

---

## B · Da riga di comando

Se hai già `git` configurato:

```bash
cd portale-incassi
git init
git add .
git commit -m "primo caricamento"
git branch -M main
git remote add origin https://github.com/<tuo-utente>/portale-incassi.git
git push -u origin main
```

Se preferisci evitare la gestione manuale dei token, con
[GitHub CLI](https://cli.github.com) l'autenticazione avviene dal browser:

```bash
gh auth login
cd portale-incassi
git init && git add . && git commit -m "primo caricamento"
gh repo create portale-incassi --private --source=. --push
```

---

## Aggiornamenti successivi

Dal browser: apri il file nel repository, premi l'icona della matita, incolla
la nuova versione e conferma. Oppure **Add file → Upload files** e ricarica.

Da riga di comando:

```bash
git add . && git commit -m "aggiornamento" && git push
```
