import React, { useRef, useState } from 'react'
import { analizzaFile, ETICHETTA_STUDIO, SEZIONALI } from '../lib/parse'
import { supabase } from '../lib/supabase'
import { euro, numero, dataIt } from '../lib/format'
import { Carta, Tabella } from '../components/ui'

const LOTTO = 400

export default function Caricamenti ({ caricamenti, admin, onImportato, onRicarica }) {
  const input = useRef(null)
  const [sopra, setSopra] = useState(false)
  const [analisi, setAnalisi] = useState([])
  const [stato, setStato] = useState(null)
  const [errore, setErrore] = useState(null)
  const [inCorso, setInCorso] = useState(false)

  async function esamina (files) {
    setErrore(null)
    setStato(null)
    const out = []
    for (const f of files) {
      try {
        out.push(await analizzaFile(f))
      } catch (e) {
        setErrore(e.message)
      }
    }
    setAnalisi(out)
  }

  async function importa () {
    if (!analisi.length) return
    setInCorso(true)
    setErrore(null)
    setStato(null)
    try {
      let inserite = 0
      let aggiornate = 0
      for (const a of analisi) {
        const perStudio = {}
        a.righe.forEach((r) => { (perStudio[r.studio] ||= []).push(r) })

        for (const [studio, righe] of Object.entries(perStudio)) {
          const { data: car, error: e1 } = await supabase
            .from('caricamenti')
            .insert({
              nome_file: a.nomeFile,
              studio,
              righe: righe.length,
              periodo_da: a.periodo.da,
              periodo_a: a.periodo.a,
              utente_id: (await supabase.auth.getUser()).data.user.id
            })
            .select('id')
            .single()
          if (e1) throw e1

          for (let i = 0; i < righe.length; i += LOTTO) {
            const lotto = righe.slice(i, i + LOTTO)
            const { data, error } = await supabase.rpc('importa_proforma', {
              righe: lotto,
              caricamento: car.id
            })
            if (error) throw error
            const res = Array.isArray(data) ? data[0] : data
            inserite += res?.inserite ?? 0
            aggiornate += res?.aggiornate ?? 0
          }
        }
      }
      setStato(
        `Importate ${numero(inserite)} nuove proforma e aggiornate ${numero(Math.max(aggiornate, 0))} già presenti.`
      )
      setAnalisi([])
      if (input.current) input.current.value = ''
      await onImportato()
    } catch (e) {
      setErrore(e.message || 'Importazione non riuscita.')
    } finally {
      setInCorso(false)
    }
  }

  async function svuota () {
    if (!confirm('Questa operazione elimina tutte le proforma archiviate. Procedere?')) return
    setInCorso(true)
    const { error } = await supabase.rpc('svuota_archivio')
    setInCorso(false)
    if (error) setErrore(error.message)
    else { setStato('Archivio svuotato.'); await onImportato() }
  }

  const totRighe = analisi.reduce((s, a) => s + a.righe.length, 0)
  const totScarti = analisi.reduce((s, a) => s + a.scarti.length, 0)

  return (
    <div className="griglia" style={{ gap: 18 }}>
      {!admin && (
        <div className="avviso">
          Il tuo profilo è in sola lettura. Per caricare nuovi export chiedi a un amministratore
          di modificare il tuo ruolo nella tabella <b>membri</b>.
        </div>
      )}

      {admin && (
        <Carta titolo="Carica un nuovo export"
               didascalia="Accetta i file .xlsx, .xls e .csv esportati dal gestionale. Il sezionale viene letto dal numero documento; ricaricare lo stesso periodo aggiorna le date di incasso senza creare duplicati.">
          <div
            className={`zona ${sopra ? 'attiva' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => input.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') input.current?.click() }}
            onDragOver={(e) => { e.preventDefault(); setSopra(true) }}
            onDragLeave={() => setSopra(false)}
            onDrop={(e) => { e.preventDefault(); setSopra(false); esamina([...e.dataTransfer.files]) }}
          >
            <div className="titolo">Trascina qui i file, oppure scegli dal computer</div>
            <div className="aiuto">
              Sezionali C, P e D → {ETICHETTA_STUDIO.STUDIRIUNITI} · sezionale T → {ETICHETTA_STUDIO.TECNACCISE}
            </div>
          </div>
          <input ref={input} type="file" multiple accept=".xlsx,.xls,.csv"
                 style={{ display: 'none' }}
                 onChange={(e) => esamina([...e.target.files])} />

          {errore && <div className="errore" style={{ marginTop: 14 }}>{errore}</div>}
          {stato && <div className="riuscito" style={{ marginTop: 14 }}>{stato}</div>}

          {analisi.length > 0 && (
            <div style={{ marginTop: 16 }}>
              {analisi.map((a) => (
                <div key={a.nomeFile} style={{ marginBottom: 12 }}>
                  <h3>{a.nomeFile}</h3>
                  <p className="didascalia" style={{ marginBottom: 6 }}>
                    {numero(a.righe.length)} righe valide · periodo {dataIt(a.periodo.da)} – {dataIt(a.periodo.a)} ·
                    {' '}{a.studi.map((s) => ETICHETTA_STUDIO[s]).join(', ')}
                  </p>
                  {Object.entries(
                    a.righe.reduce((acc, r) => { acc[r.sezionale] = (acc[r.sezionale] || 0) + 1; return acc }, {})
                  ).map(([sez, n]) => (
                    <span key={sez} className="pillola neutro" style={{ marginRight: 6 }}>
                      Sez. {sez} · {numero(n)} doc. · {ETICHETTA_STUDIO[SEZIONALI[sez]]}
                    </span>
                  ))}
                  {a.avvisi.map((av, i) => (
                    <div className="avviso" key={i} style={{ marginTop: 8 }}>{av}</div>
                  ))}
                  {a.scarti.length > 0 && (
                    <div className="avviso" style={{ marginTop: 8 }}>
                      {numero(a.scarti.length)} righe non importabili. Prime segnalazioni:{' '}
                      {a.scarti.slice(0, 3).map((s) => `riga ${s.riga} (${s.motivo})`).join('; ')}.
                    </div>
                  )}
                </div>
              ))}

              <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                <button className="bottone" onClick={importa} disabled={inCorso || !totRighe}>
                  {inCorso ? <><span className="caricando" /> Importazione…</>
                           : `Importa ${numero(totRighe)} proforma`}
                </button>
                <button className="bottone secondario" onClick={() => { setAnalisi([]); setErrore(null) }}
                        disabled={inCorso}>
                  Annulla
                </button>
                {totScarti > 0 && (
                  <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--grigio)' }}>
                    {numero(totScarti)} righe verranno ignorate
                  </span>
                )}
              </div>
            </div>
          )}
        </Carta>
      )}

      <Carta titolo="Storico dei caricamenti"
             azioni={
               <div style={{ display: 'flex', gap: 8 }}>
                 <button className="bottone secondario piccolo" onClick={onRicarica}>Aggiorna</button>
                 {admin && (
                   <button className="bottone pericolo piccolo" onClick={svuota} disabled={inCorso}>
                     Svuota archivio
                   </button>
                 )}
               </div>
             }>
        <Tabella
          ordineIniziale="creato_il"
          chiave={(r) => r.id}
          vuoto="Nessun file ancora importato."
          righe={caricamenti}
          colonne={[
            { id: 'creato_il', titolo: 'Data', render: (r) => new Date(r.creato_il).toLocaleString('it-IT') },
            { id: 'nome_file', titolo: 'File' },
            { id: 'studio', titolo: 'Studio', render: (r) => ETICHETTA_STUDIO[r.studio] || r.studio },
            { id: 'righe', titolo: 'Righe', num: true, render: (r) => numero(r.righe) },
            {
              id: 'periodo',
              titolo: 'Periodo',
              ordinabile: false,
              render: (r) => `${dataIt(r.periodo_da)} – ${dataIt(r.periodo_a)}`
            }
          ]}
        />
      </Carta>
    </div>
  )
}
