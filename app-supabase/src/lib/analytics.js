/* ---------------------------------------------------------------------
   Motore di calcolo. Tutto gira sul client: gli archivi di uno studio
   professionale stanno comodamente in memoria e i filtri restano
   istantanei.
   --------------------------------------------------------------------- */

export const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

/* Famiglie di prestazione: raggruppano le decine di voci dell'export in
   categorie leggibili. L'ordine conta, vince la prima che corrisponde. */
const FAMIGLIE = [
  [/RID MENSILE|FATTURAZIONE STUDIRIUNITI/, 'Contabilità ricorrente'],
  [/LIQ|LI\.?PE|ACCONTO IVA|MOD\.? IVA|INTRASTAT|INTENTO/, 'Adempimenti IVA periodici'],
  [/REDDITI|730|IRAP|CERTIFICAZIONI UNICHE|\b770\b|SISTEMA TS|DETRAZIONI CONDOMINIO/, 'Dichiarativi annuali'],
  [/BILANCIO|VERBALE|CESSIONE QUOTE|SCHEMA ATTO|VIDIMAZIONE/, 'Bilancio e adempimenti societari'],
  [/CCIAA|VISURA|ISCRIZIONE|COSTITUZIONE|APERTURA P\.?IVA|MARCHIO|ATECO|DURC|PEC AMMINISTRATORI/, 'Pratiche camerali e societarie'],
  [/INPS|INAIL/, 'Adempimenti previdenziali'],
  [/IMU|BOLLI/, 'Tributi locali e bolli'],
  [/SGRAVIO|CIVIS|ROTTAMAZIONE|RATEIZZAZIONE|INTEGRATIVA|SEGNALAZIONE/, 'Contenzioso e riscossione'],
  [/F24|PORTALE FATTURAZIONE|ADDEBIT/, 'Servizi telematici'],
  [/ACCISE|ADM|GSE|GAUDI|DICHIARAZIONE ANNUALE CONSUMI|ENERG|FOTOVOLTAIC|UTF/, 'Accise ed energia']
]

export function famiglia (voce) {
  const v = String(voce).toUpperCase()
  for (const [re, nome] of FAMIGLIE) if (re.test(v)) return nome
  return 'Attività spot e altre pratiche'
}

/* ------------------------------- utilità ------------------------------ */

const giorni = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000)
export const anno = (d) => Number(String(d).slice(0, 4))
export const mese = (d) => Number(String(d).slice(5, 7))
export const giornoDellAnno = (d) => {
  const x = new Date(d)
  return Math.floor((x - new Date(x.getFullYear(), 0, 0)) / 86400000)
}

export const somma = (a, f = (x) => x) => a.reduce((s, x) => s + (Number(f(x)) || 0), 0)

export function mediaPonderata (righe, valore, peso) {
  let n = 0, d = 0
  righe.forEach((r) => {
    const p = Math.max(Number(peso(r)) || 0, 0.01)
    n += (Number(valore(r)) || 0) * p
    d += p
  })
  return d ? n / d : null
}

export function mediana (v) {
  if (!v.length) return null
  const s = [...v].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/* Arricchisce le righe con i campi derivati usati ovunque. */
export function prepara (righe, dataRiferimento) {
  const oggi = dataRiferimento || new Date().toISOString().slice(0, 10)
  return righe.map((r) => {
    const incassata = !!r.data_incasso
    return {
      ...r,
      incassata,
      // Gli incassi anticipati (tipici del RID) valgono zero giorni,
      // non giorni negativi: altrimenti abbasserebbero il DSO in modo fittizio.
      gg: incassata ? Math.max(giorni(r.data_doc, r.data_incasso), 0) : null,
      ggAperti: incassata ? null : Math.max(giorni(r.data_doc, oggi), 0),
      // Età del documento alla data di riferimento: serve a capire quali
      // scadenze sono già verificabili e quali no.
      eta: Math.max(giorni(r.data_doc, oggi), 0),
      anno: anno(r.data_doc),
      mese: mese(r.data_doc),
      doy: giornoDellAnno(r.data_doc),
      annoIncasso: incassata ? anno(r.data_incasso) : null,
      meseIncasso: incassata ? mese(r.data_incasso) : null
    }
  })
}

/* ------------------------------ indicatori ---------------------------- */

export function indicatori (righe) {
  const incassate = righe.filter((r) => r.incassata)
  const aperte = righe.filter((r) => !r.incassata)
  const imponibile = somma(righe, (r) => r.imponibile)
  const incassato = somma(incassate, (r) => r.imponibile)
  return {
    documenti: righe.length,
    clienti: new Set(righe.map((r) => r.cliente_key)).size,
    imponibile,
    totale: somma(righe, (r) => r.totale),
    incassato,
    aperto: somma(aperte, (r) => r.imponibile),
    apertoLordo: somma(aperte, (r) => r.totale),
    documentiAperti: aperte.length,
    quotaIncassata: imponibile ? (incassato / imponibile) * 100 : null,
    dso: mediaPonderata(incassate, (r) => r.gg, (r) => r.imponibile),
    dsoMediano: mediana(incassate.map((r) => r.gg)),
    ticketMedio: righe.length ? imponibile / righe.length : 0,
    ticketMediano: mediana(righe.map((r) => r.imponibile))
  }
}

/* Serie mensile: emesso per data documento, incassato per data incasso. */
export function serieMensile (righe) {
  const m = new Map()
  const tocca = (k) => {
    if (!m.has(k)) m.set(k, { periodo: k, emesso: 0, incassato: 0, documenti: 0 })
    return m.get(k)
  }
  righe.forEach((r) => {
    const e = tocca(`${r.anno}-${String(r.mese).padStart(2, '0')}`)
    e.emesso += r.imponibile
    e.documenti += 1
    if (r.incassata) {
      tocca(`${r.annoIncasso}-${String(r.meseIncasso).padStart(2, '0')}`).incassato += r.imponibile
    }
  })
  return [...m.values()]
    .sort((a, b) => a.periodo.localeCompare(b.periodo))
    .map((x) => ({ ...x, etichetta: `${MESI[Number(x.periodo.slice(5)) - 1]} ${x.periodo.slice(2, 4)}` }))
}

/* Curva cumulata di incasso.
   Ogni tappa si calcola solo sui documenti che hanno già avuto il tempo
   di arrivarci: per il punto a 90 giorni contano i documenti emessi da
   almeno 90 giorni. Senza questo accorgimento l'anno in corso sembrerebbe
   sempre peggiore, perché le sue fatture più recenti risulterebbero
   "non pagate" solo per mancanza di tempo. */
export const TAPPE = [0, 7, 15, 30, 45, 60, 90, 120, 180]

/* Scadenza più lontana per cui restano abbastanza documenti maturi. */
export function orizzonteUtile (righe, tappe = TAPPE, quotaMinima = 0.2) {
  const minimo = Math.max(20, Math.round(righe.length * quotaMinima))
  const ok = tappe.filter((g) => righe.filter((r) => r.eta >= g).length >= minimo)
  return ok.length ? ok[ok.length - 1] : null
}

export function curvaIncasso (righe, { tappe = TAPPE, orizzonte = null } = {}) {
  if (!righe.length) return []

  /* La curva usa una sola coorte per tutti i punti: cambiando denominatore
     a ogni scadenza potrebbe perfino scendere. Quando si confrontano più
     anni conviene passare lo stesso orizzonte per tutti, altrimenti l'anno
     in corso verrebbe giudicato su una coorte più ristretta e diversa. */
  const o = orizzonte ?? orizzonteUtile(righe, tappe)
  if (o === null) return []
  const raggiungibili = tappe.filter((g) => g <= o)
  const coorte = righe.filter((r) => r.eta >= o)
  const base = somma(coorte, (r) => r.imponibile)
  if (!base) return []

  return raggiungibili.map((g) => ({
    giorni: g,
    quota: (somma(coorte.filter((r) => r.incassata && r.gg <= g), (r) => r.imponibile) / base) * 100,
    base,
    documenti: coorte.length
  }))
}

export const FASCE_INCASSO = [
  { max: 0, nome: 'Contestuale' },
  { max: 7, nome: '1-7 gg' },
  { max: 15, nome: '8-15 gg' },
  { max: 30, nome: '16-30 gg' },
  { max: 60, nome: '31-60 gg' },
  { max: 90, nome: '61-90 gg' },
  { max: Infinity, nome: 'Oltre 90 gg' }
]

export function fasceIncasso (righe) {
  const inc = righe.filter((r) => r.incassata)
  const tot = somma(inc, (r) => r.imponibile) || 1
  return FASCE_INCASSO.map((f, i) => {
    const min = i === 0 ? -1 : FASCE_INCASSO[i - 1].max
    const sel = inc.filter((r) => r.gg > min && r.gg <= f.max)
    return {
      fascia: f.nome,
      documenti: sel.length,
      importo: somma(sel, (r) => r.imponibile),
      quota: (somma(sel, (r) => r.imponibile) / tot) * 100
    }
  })
}

export const FASCE_ANZIANITA = [
  { max: 30, nome: '0-30 gg' },
  { max: 60, nome: '31-60 gg' },
  { max: 90, nome: '61-90 gg' },
  { max: 180, nome: '91-180 gg' },
  { max: 365, nome: '181-365 gg' },
  { max: Infinity, nome: 'Oltre 365 gg' }
]

export function anzianitaCredito (righe) {
  const aperte = righe.filter((r) => !r.incassata)
  return FASCE_ANZIANITA.map((f, i) => {
    const min = i === 0 ? -1 : FASCE_ANZIANITA[i - 1].max
    const sel = aperte.filter((r) => r.ggAperti > min && r.ggAperti <= f.max)
    return {
      fascia: f.nome,
      documenti: sel.length,
      importo: somma(sel, (r) => r.imponibile),
      lordo: somma(sel, (r) => r.totale)
    }
  })
}

/* ------------------------------- attività ----------------------------- */

/* Si usano i soli valori positivi delle colonne di dettaglio: le voci
   negative sono storni e sconti, che falserebbero la composizione. */
function esplodiAttivita (righe) {
  const out = []
  righe.forEach((r) => {
    Object.entries(r.attivita || {}).forEach(([voce, importo]) => {
      if (importo > 0) out.push({ voce, importo, riga: r })
    })
  })
  return out
}

export function ripartizioneAttivita (righe, { perFamiglia = false } = {}) {
  const voci = esplodiAttivita(righe)
  const acc = new Map()
  voci.forEach(({ voce, importo, riga }) => {
    const k = perFamiglia ? famiglia(voce) : voce
    if (!acc.has(k)) acc.set(k, { nome: k, importo: 0, documenti: new Set(), anni: {} })
    const e = acc.get(k)
    e.importo += importo
    e.documenti.add(riga.n_doc + riga.data_doc)
    e.anni[riga.anno] = (e.anni[riga.anno] || 0) + importo
  })
  const tot = somma([...acc.values()], (x) => x.importo) || 1
  return [...acc.values()]
    .map((x) => ({ ...x, documenti: x.documenti.size, quota: (x.importo / tot) * 100 }))
    .sort((a, b) => b.importo - a.importo)
}

/* Tempi di incasso per famiglia: mostra quali prestazioni assorbono cassa. */
export function tempisticheFamiglia (righe) {
  const acc = new Map()
  righe.forEach((r) => {
    const voci = Object.entries(r.attivita || {}).filter(([, v]) => v > 0)
    if (!voci.length) return
    // Alla riga si assegna la famiglia della voce di importo maggiore.
    const prevalente = voci.sort((a, b) => b[1] - a[1])[0][0]
    const k = famiglia(prevalente)
    if (!acc.has(k)) acc.set(k, { nome: k, righe: [] })
    acc.get(k).righe.push(r)
  })
  return [...acc.values()]
    .map(({ nome, righe: rr }) => {
      const inc = rr.filter((r) => r.incassata)
      const imp = somma(rr, (r) => r.imponibile)
      return {
        nome,
        documenti: rr.length,
        imponibile: imp,
        dso: mediaPonderata(inc, (r) => r.gg, (r) => r.imponibile),
        mediana: mediana(inc.map((r) => r.gg)),
        quotaAperta: imp ? (somma(rr.filter((r) => !r.incassata), (r) => r.imponibile) / imp) * 100 : 0
      }
    })
    .filter((x) => x.imponibile > 0)
    .sort((a, b) => b.imponibile - a.imponibile)
}

/* ------------------------------- clienti ------------------------------ */

/* Punteggio di affidabilità 0-100.
   Tre componenti, perché un cliente può essere lento ma sempre saldare,
   oppure puntuale in media e avere una posizione ferma da un anno.
     - velocità   : DSO ponderato
     - esposizione: quota di fatturato ancora aperta
     - anzianità  : giorni della posizione aperta più vecchia            */
function punteggio ({ dso, quotaAperta, apertoMax }) {
  const vel = dso === null ? 70 : Math.max(0, 100 - Math.min(dso, 120) * (100 / 120))
  const esp = Math.max(0, 100 - Math.min(quotaAperta, 60) * (100 / 60))
  const anz = apertoMax === null ? 100 : Math.max(0, 100 - Math.min(apertoMax, 365) * (100 / 365))
  return Math.round(vel * 0.45 + esp * 0.35 + anz * 0.20)
}

export const GIUDIZI = [
  { min: 85, nome: 'Eccellente', tono: 'ottimo' },
  { min: 70, nome: 'Affidabile', tono: 'buono' },
  { min: 50, nome: 'Da monitorare', tono: 'attenzione' },
  { min: 0, nome: 'Critico', tono: 'critico' }
]

export const giudizioDa = (p) => GIUDIZI.find((g) => p >= g.min)

export function schedeClienti (righe) {
  const acc = new Map()
  righe.forEach((r) => {
    if (!acc.has(r.cliente_key)) {
      acc.set(r.cliente_key, { key: r.cliente_key, nome: r.cliente, righe: [] })
    }
    const e = acc.get(r.cliente_key)
    e.righe.push(r)
    if (r.cliente.length > e.nome.length) e.nome = r.cliente
  })

  return [...acc.values()]
    .map(({ key, nome, righe: rr }) => {
      const inc = rr.filter((r) => r.incassata)
      const aperte = rr.filter((r) => !r.incassata)
      const imponibile = somma(rr, (r) => r.imponibile)
      const aperto = somma(aperte, (r) => r.imponibile)
      const dso = mediaPonderata(inc, (r) => r.gg, (r) => r.imponibile)
      const med = mediana(inc.map((r) => r.gg))
      const quotaAperta = imponibile ? (aperto / imponibile) * 100 : 0
      const apertoMax = aperte.length ? Math.max(...aperte.map((r) => r.ggAperti)) : null
      const p = punteggio({ dso, quotaAperta, apertoMax })

      // Divergenza fra media ponderata e mediana: distingue il ritardatario
      // cronico dall'incidente isolato su una pratica di importo alto.
      const cronico = dso !== null && med !== null && med >= 30
      const episodico = dso !== null && med !== null && dso - med >= 25 && med < 30

      return {
        key,
        nome,
        studi: [...new Set(rr.map((r) => r.studio))],
        documenti: rr.length,
        imponibile,
        incassato: somma(inc, (r) => r.imponibile),
        aperto,
        apertoLordo: somma(aperte, (r) => r.totale),
        documentiAperti: aperte.length,
        quotaAperta,
        dso,
        mediana: med,
        ggMax: inc.length ? Math.max(...inc.map((r) => r.gg)) : null,
        apertoMax,
        punteggio: p,
        giudizio: giudizioDa(p),
        profilo: cronico ? 'cronico' : episodico ? 'episodico' : 'regolare',
        primo: rr.reduce((a, r) => (r.data_doc < a ? r.data_doc : a), rr[0].data_doc),
        ultimo: rr.reduce((a, r) => (r.data_doc > a ? r.data_doc : a), rr[0].data_doc),
        tempi: inc.map((r) => r.gg).sort((a, b) => a - b),
        righe: rr
      }
    })
    .sort((a, b) => b.imponibile - a.imponibile)
}

export function concentrazione (clienti) {
  const tot = somma(clienti, (c) => c.imponibile) || 1
  let cum = 0
  return clienti.map((c, i) => {
    cum += c.imponibile
    return { posizione: i + 1, quota: (cum / tot) * 100 }
  })
}

/* ---------------------- confronto fra esercizi ------------------------ */

/* Il confronto fra un anno chiuso e un anno in corso è ingannevole.
   'finoAlGiorno' ritaglia in entrambi gli anni la stessa finestra
   1 gennaio - stessa data, così i volumi sono comparabili. */
export function confrontoAnni (righe, { finoAlGiorno = null } = {}) {
  const sel = finoAlGiorno ? righe.filter((r) => r.doy <= finoAlGiorno) : righe
  const anni = [...new Set(sel.map((r) => r.anno))].sort()
  return anni.map((a) => {
    const rr = sel.filter((r) => r.anno === a)
    return { anno: a, ...indicatori(rr), righe: rr }
  })
}

export function variazione (attuale, precedente) {
  if (precedente === null || precedente === undefined || precedente === 0) return null
  return ((attuale - precedente) / Math.abs(precedente)) * 100
}

/* Clienti persi, mantenuti e acquisiti fra due anni. */
export function movimentiClienti (righe, annoA, annoB) {
  const setA = new Set(righe.filter((r) => r.anno === annoA).map((r) => r.cliente_key))
  const setB = new Set(righe.filter((r) => r.anno === annoB).map((r) => r.cliente_key))
  const mantenuti = [...setB].filter((k) => setA.has(k))
  const nuovi = [...setB].filter((k) => !setA.has(k))
  const persi = [...setA].filter((k) => !setB.has(k))
  const impDi = (keys, a) =>
    somma(righe.filter((r) => r.anno === a && keys.includes(r.cliente_key)), (r) => r.imponibile)
  return {
    mantenuti: mantenuti.length,
    nuovi: nuovi.length,
    persi: persi.length,
    ritenzione: setA.size ? (mantenuti.length / setA.size) * 100 : null,
    imponibileMantenuti: impDi(mantenuti, annoB),
    imponibileNuovi: impDi(nuovi, annoB),
    imponibilePersi: impDi(persi, annoA),
    chiaviPersi: persi
  }
}

/* Effetto del mandato RID: è la leva più forte sui tempi di incasso. */
export function effettoRid (righe) {
  const conRid = (r) => Object.keys(r.attivita || {}).some((v) => /RID MENSILE/i.test(v))
  const gruppo = (sel) => {
    const inc = sel.filter((r) => r.incassata)
    const imp = somma(sel, (r) => r.imponibile)
    return {
      documenti: sel.length,
      imponibile: imp,
      dso: mediaPonderata(inc, (r) => r.gg, (r) => r.imponibile),
      quotaAperta: imp ? (somma(sel.filter((r) => !r.incassata), (r) => r.imponibile) / imp) * 100 : 0
    }
  }
  return { con: gruppo(righe.filter(conRid)), senza: gruppo(righe.filter((r) => !conRid(r))) }
}
