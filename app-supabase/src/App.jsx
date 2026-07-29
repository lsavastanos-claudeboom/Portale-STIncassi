import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase, configurato } from './lib/supabase'
import { ETICHETTA_STUDIO, SEZIONALI } from './lib/parse'
import { prepara } from './lib/analytics'
import { numero } from './lib/format'
import Accesso from './components/Accesso'
import Panoramica from './views/Panoramica'
import Tempistiche from './views/Tempistiche'
import Attivita from './views/Attivita'
import Clienti from './views/Clienti'
import Confronti from './views/Confronti'
import Caricamenti from './views/Caricamenti'

const SEZIONI = [
  { id: 'panoramica', nome: 'Panoramica', titolo: 'Panoramica', occhiello: 'Sintesi',
    testo: 'Volumi, incassi e criticità del periodo selezionato.' },
  { id: 'tempistiche', nome: 'Tempi di incasso', titolo: 'Tempi di incasso', occhiello: 'Circolante',
    testo: 'Quanto ci mette il fatturato a rientrare, e dove si ferma.' },
  { id: 'attivita', nome: 'Attività', titolo: 'Attività fatturate', occhiello: 'Ricavi',
    testo: 'Quali prestazioni generano il fatturato e come cambia il mix.' },
  { id: 'clienti', nome: 'Clienti', titolo: 'Clienti', occhiello: 'Portafoglio',
    testo: 'Chi paga puntuale, chi va sollecitato e chi è da rivedere.' },
  { id: 'confronti', nome: 'Confronti', titolo: 'Confronto fra esercizi', occhiello: 'Andamento',
    testo: 'Come si muovono volumi, mix e incassi da un anno all\'altro.' },
  { id: 'caricamenti', nome: 'Caricamenti', titolo: 'Caricamenti', occhiello: 'Archivio',
    testo: 'Importa gli export del gestionale e controlla lo storico.' }
]

const PAGINA = 1000

export default function App () {
  const [sessione, setSessione] = useState(null)
  const [pronto, setPronto] = useState(false)
  const [membro, setMembro] = useState(null)
  const [grezze, setGrezze] = useState([])
  const [caricamenti, setCaricamenti] = useState([])
  const [caricando, setCaricando] = useState(false)
  const [erroreDati, setErroreDati] = useState(null)

  const [sezione, setSezione] = useState('panoramica')
  const [studio, setStudio] = useState('TUTTI')
  const [sezionale, setSezionale] = useState('TUTTI')
  const [annoScelto, setAnnoScelto] = useState('TUTTI')

  /* ------------------------------------------------------------ sessione */
  useEffect(() => {
    if (!configurato) { setPronto(true); return }
    supabase.auth.getSession().then(({ data }) => { setSessione(data.session); setPronto(true) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSessione(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  /* ---------------------------------------------------------------- dati */
  const caricaDati = useCallback(async () => {
    if (!sessione) return
    setCaricando(true)
    setErroreDati(null)
    try {
      const { data: m } = await supabase
        .from('membri').select('*').eq('user_id', sessione.user.id).maybeSingle()
      setMembro(m)

      const tutte = []
      for (let da = 0; ; da += PAGINA) {
        const { data, error } = await supabase
          .from('proforma')
          .select('studio,sezionale,n_doc,data_doc,data_incasso,cliente,cliente_key,imponibile,cassa,iva,totale,quantita,intermediario,attivita')
          .order('data_doc', { ascending: false })
          .range(da, da + PAGINA - 1)
        if (error) throw error
        tutte.push(...data)
        if (data.length < PAGINA) break
      }
      setGrezze(tutte)

      const { data: car } = await supabase
        .from('caricamenti').select('*').order('creato_il', { ascending: false }).limit(60)
      setCaricamenti(car || [])
    } catch (e) {
      setErroreDati(
        /relation .* does not exist/i.test(e.message)
          ? 'Le tabelle non esistono ancora: esegui supabase/schema.sql nel SQL Editor del progetto.'
          : e.message
      )
    } finally {
      setCaricando(false)
    }
  }, [sessione])

  useEffect(() => { caricaDati() }, [caricaDati])

  /* ------------------------------------------------------------- filtri */

  /* La data più recente presente in archivio è il riferimento per le
     finestre omogenee e per l'anzianità del credito: usare "oggi" darebbe
     numeri sbagliati su un archivio non aggiornato da mesi. */
  const dataRiferimento = useMemo(() => {
    let max = '0000-01-01'
    grezze.forEach((r) => {
      if (r.data_doc > max) max = r.data_doc
      if (r.data_incasso && r.data_incasso > max) max = r.data_incasso
    })
    return max === '0000-01-01' ? new Date().toISOString().slice(0, 10) : max
  }, [grezze])

  const preparate = useMemo(() => prepara(grezze, dataRiferimento), [grezze, dataRiferimento])

  const anni = useMemo(
    () => [...new Set(preparate.map((r) => r.anno))].sort((a, b) => b - a),
    [preparate]
  )

  const sezionaliDisponibili = useMemo(() => {
    const s = new Set(preparate
      .filter((r) => studio === 'TUTTI' || r.studio === studio)
      .map((r) => r.sezionale))
    return [...s].sort()
  }, [preparate, studio])

  const righe = useMemo(() => preparate.filter((r) => {
    if (studio !== 'TUTTI' && r.studio !== studio) return false
    if (sezionale !== 'TUTTI' && r.sezionale !== sezionale) return false
    if (annoScelto !== 'TUTTI' && r.anno !== Number(annoScelto)) return false
    return true
  }), [preparate, studio, sezionale, annoScelto])

  /* ------------------------------------------------------------- render */
  if (!pronto) return <div className="accesso"><div className="riquadro"><span className="caricando" /></div></div>
  if (!sessione) return <Accesso />

  const attiva = SEZIONI.find((s) => s.id === sezione)
  const admin = membro?.ruolo === 'admin'
  const vuoto = !caricando && preparate.length === 0

  const contenuto = () => {
    if (erroreDati) return <div className="errore">{erroreDati}</div>
    if (caricando) return <div className="vuoto"><p>Caricamento dell'archivio…</p></div>
    if (vuoto && sezione !== 'caricamenti') {
      return (
        <div className="vuoto">
          <h3>L'archivio è vuoto</h3>
          <p>Carica il primo export del gestionale per vedere le analisi.</p>
          <button className="bottone" onClick={() => setSezione('caricamenti')}>Vai ai caricamenti</button>
        </div>
      )
    }
    switch (sezione) {
      case 'tempistiche': return <Tempistiche righe={righe} />
      case 'attivita': return <Attivita righe={righe} />
      case 'clienti': return <Clienti righe={righe} />
      case 'confronti': return <Confronti righe={righe} dataRiferimento={dataRiferimento} />
      case 'caricamenti':
        return <Caricamenti caricamenti={caricamenti} admin={admin}
                            onImportato={caricaDati} onRicarica={caricaDati} />
      default: return <Panoramica righe={righe} dataRiferimento={dataRiferimento} />
    }
  }

  return (
    <div className="app">
      <aside className="barra">
        <div className="marchio">
          <div className="nome">Portale Incassi</div>
          <div className="sotto">Studi Riuniti · TecnAccise</div>
        </div>

        <nav className="nav" aria-label="Sezioni">
          {SEZIONI.map((s, i) => (
            <button key={s.id} aria-current={sezione === s.id} onClick={() => setSezione(s.id)}>
              <span className="indice">{String(i + 1).padStart(2, '0')}</span>
              {s.nome}
            </button>
          ))}
        </nav>

        <div className="utente">
          <div className="mail">{sessione.user.email}</div>
          <div style={{ marginBottom: 10 }}>
            {admin ? 'Amministratore' : 'Sola lettura'} · {numero(preparate.length)} proforma
          </div>
          <button className="bottone secondario piccolo" onClick={() => supabase.auth.signOut()}>Esci</button>
        </div>
      </aside>

      <main className="contenuto">
        <header className="testata">
          <div>
            <div className="occhiello">{attiva.occhiello}</div>
            <h1>{attiva.titolo}</h1>
            <p>{attiva.testo}</p>
          </div>

          {sezione !== 'caricamenti' && preparate.length > 0 && (
            <div className="filtri">
              <div className="gruppo">
                <button aria-pressed={studio === 'TUTTI'}
                        onClick={() => { setStudio('TUTTI'); setSezionale('TUTTI') }}>Entrambi</button>
                {Object.keys(ETICHETTA_STUDIO).map((s) => (
                  <button key={s} aria-pressed={studio === s}
                          onClick={() => { setStudio(s); setSezionale('TUTTI') }}>
                    {ETICHETTA_STUDIO[s]}
                  </button>
                ))}
              </div>

              {sezionaliDisponibili.length > 1 && (
                <div className="gruppo">
                  <button aria-pressed={sezionale === 'TUTTI'} onClick={() => setSezionale('TUTTI')}>Sez.</button>
                  {sezionaliDisponibili.map((s) => (
                    <button key={s} className="sez" aria-pressed={sezionale === s}
                            onClick={() => setSezionale(s)}
                            title={ETICHETTA_STUDIO[SEZIONALI[s]]}>{s}</button>
                  ))}
                </div>
              )}

              <div className="gruppo">
                <button aria-pressed={annoScelto === 'TUTTI'} onClick={() => setAnnoScelto('TUTTI')}>
                  Tutti gli anni
                </button>
                {anni.map((a) => (
                  <button key={a} className="sez" aria-pressed={annoScelto === String(a)}
                          onClick={() => setAnnoScelto(String(a))}>{a}</button>
                ))}
              </div>
            </div>
          )}
        </header>

        {contenuto()}
      </main>
    </div>
  )
}
