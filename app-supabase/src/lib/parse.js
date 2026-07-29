import * as XLSX from 'xlsx'

/* Mappa sezionale -> studio.
   Studiriuniti raggruppa C, P e D; TecnAccise è il solo sezionale T. */
export const SEZIONALI = {
  C: 'STUDIRIUNITI',
  P: 'STUDIRIUNITI',
  D: 'STUDIRIUNITI',
  T: 'TECNACCISE'
}

export const STUDI = ['STUDIRIUNITI', 'TECNACCISE']

export const ETICHETTA_STUDIO = {
  STUDIRIUNITI: 'Studi Riuniti',
  TECNACCISE: 'TecnAccise'
}

/* Le prime colonne dell'export sono anagrafiche; tutto ciò che segue
   'DATA EXPORT XML' è dettaglio delle attività fatturate. */
const COLONNE_FISSE = [
  'CATEGORIA', 'N. DOC', 'DATA DOC.', 'DATA INCASSO', 'CLIENTE', 'IMPONIBILE',
  'CASSA 4%', 'IVA 22%', 'IVA 22% PER CASSA', 'SPESE ART.15', 'QUANTITÀ',
  'TOTALE', 'PROVVIGIONI INTERMEDIARIO', 'INTERMEDIARIO', 'DATA EXPORT XML'
]

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim()
const chiave = (s) => norm(s).toUpperCase().replace(/[^A-Z0-9]/g, '')

/* Numeri in formato italiano: 1.234,56 — il segno meno va conservato,
   mentre un trattino isolato significa "campo vuoto". */
export function numero (v) {
  if (v === null || v === undefined) return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  let s = norm(v)
  if (s === '' || s === '-') return 0
  s = s.replace(/\./g, '').replace(',', '.').replace(/[^0-9.\-]/g, '')
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

/* Date: gg/mm/aaaa, oppure seriale Excel, oppure oggetto Date. */
export function data (v) {
  if (v === null || v === undefined) return null
  if (v instanceof Date && !isNaN(v)) return iso(v)
  if (typeof v === 'number' && v > 20000 && v < 60000) {
    const d = XLSX.SSF.parse_date_code(v)
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  const s = norm(v)
  if (s === '' || s === '-') return null
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (m) {
    let [, g, mm, a] = m
    if (a.length === 2) a = (Number(a) > 60 ? '19' : '20') + a
    return `${a}-${mm.padStart(2, '0')}-${g.padStart(2, '0')}`
  }
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m2 ? m2[0] : null
}

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/* Il sezionale è il suffisso del numero documento: "860/C" -> C. */
export function sezionaleDa (nDoc) {
  const m = norm(nDoc).toUpperCase().match(/\/\s*([A-Z])\s*$/)
  return m ? m[1] : null
}

/* Nome cliente normalizzato: serve solo a raggruppare le righe dello
   stesso soggetto quando l'export varia in spaziatura o punteggiatura. */
export function clienteKey (nome) {
  return norm(nome)
    .toUpperCase()
    .replace(/\bS\.?\s?R\.?\s?L\.?S?\b/g, 'SRL')
    .replace(/\bS\.?\s?P\.?\s?A\.?\b/g, 'SPA')
    .replace(/\bS\.?\s?A\.?\s?S\.?\b/g, 'SAS')
    .replace(/\bS\.?\s?N\.?\s?C\.?\b/g, 'SNC')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

function leggiFoglio (buffer, nomeFile) {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true, raw: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) throw new Error(`${nomeFile}: il file non contiene fogli leggibili.`)
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false, raw: false })
}

/**
 * Converte un file (xlsx, xls o csv) nelle righe pronte per l'import.
 * Restituisce { righe, scarti, avvisi, studi, periodo }.
 */
export async function analizzaFile (file) {
  const buffer = await file.arrayBuffer()
  const matrice = leggiFoglio(buffer, file.name)
  if (!matrice.length) throw new Error(`${file.name}: nessuna riga trovata.`)

  // L'intestazione è la prima riga che contiene sia N. DOC sia IMPONIBILE.
  const idxHeader = matrice.findIndex((r) => {
    const c = r.map(chiave)
    return c.includes('NDOC') && c.includes('IMPONIBILE')
  })
  if (idxHeader === -1) {
    throw new Error(
      `${file.name}: intestazione non riconosciuta. ` +
      'Servono almeno le colonne "N. DOC" e "IMPONIBILE".'
    )
  }

  const intestazione = matrice[idxHeader].map(norm)
  const pos = {}
  COLONNE_FISSE.forEach((c) => {
    const i = intestazione.findIndex((h) => chiave(h) === chiave(c))
    if (i !== -1) pos[c] = i
  })

  const iUltimaFissa = Math.max(...Object.values(pos), -1)
  const colonneAttivita = intestazione
    .map((h, i) => ({ h, i }))
    .filter(({ h, i }) => i > iUltimaFissa && h !== '')

  const righe = []
  const scarti = []
  const avvisi = []
  const studi = new Set()
  let dataMin = null
  let dataMax = null

  for (let r = idxHeader + 1; r < matrice.length; r++) {
    const riga = matrice[r]
    const val = (c) => (pos[c] !== undefined ? riga[pos[c]] : '')

    const nDoc = norm(val('N. DOC'))
    const dataDoc = data(val('DATA DOC.'))
    const cliente = norm(val('CLIENTE'))
    if (!nDoc && !cliente) continue

    if (!nDoc || !dataDoc) {
      scarti.push({ riga: r + 1, motivo: 'numero documento o data mancante', nDoc, cliente })
      continue
    }

    let sez = sezionaleDa(nDoc)
    if (!sez) {
      // Fallback: se il numero non ha suffisso, si deduce dalla categoria.
      const cat = chiave(val('CATEGORIA'))
      sez = cat.startsWith('TECNACCISE') ? 'T' : null
      if (!sez) {
        scarti.push({ riga: r + 1, motivo: 'sezionale non deducibile dal numero documento', nDoc, cliente })
        continue
      }
    }
    const studio = SEZIONALI[sez]
    if (!studio) {
      scarti.push({ riga: r + 1, motivo: `sezionale "${sez}" non mappato ad alcuno studio`, nDoc, cliente })
      continue
    }

    const attivita = {}
    colonneAttivita.forEach(({ h, i }) => {
      const n = numero(riga[i])
      if (n !== 0) attivita[h] = Math.round(n * 100) / 100
    })

    const imponibile = numero(val('IMPONIBILE'))
    const totale = numero(val('TOTALE'))

    righe.push({
      studio,
      sezionale: sez,
      n_doc: nDoc,
      data_doc: dataDoc,
      data_incasso: data(val('DATA INCASSO')),
      cliente,
      cliente_key: clienteKey(cliente),
      imponibile,
      cassa: numero(val('CASSA 4%')),
      iva: numero(val('IVA 22%')) + numero(val('IVA 22% PER CASSA')),
      totale: totale || imponibile,
      quantita: numero(val('QUANTITÀ')) || null,
      intermediario: norm(val('INTERMEDIARIO')) || null,
      attivita
    })

    studi.add(studio)
    if (!dataMin || dataDoc < dataMin) dataMin = dataDoc
    if (!dataMax || dataDoc > dataMax) dataMax = dataDoc
  }

  if (!righe.length) throw new Error(`${file.name}: nessuna riga valida da importare.`)

  // Doppioni interni al file: l'ultima occorrenza vince.
  const visti = new Map()
  righe.forEach((x) => visti.set(`${x.studio}|${x.sezionale}|${x.n_doc}|${x.data_doc}`, x))
  const doppioni = righe.length - visti.size
  if (doppioni > 0) {
    avvisi.push(`${doppioni} righe duplicate nel file: è stata tenuta l'ultima occorrenza di ciascun documento.`)
  }
  if (studi.size > 1) {
    avvisi.push('Il file contiene sezionali di entrambi gli studi: verranno distribuiti automaticamente.')
  }

  return {
    nomeFile: file.name,
    righe: [...visti.values()],
    scarti,
    avvisi,
    studi: [...studi],
    periodo: { da: dataMin, a: dataMax }
  }
}
