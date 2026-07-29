import React, { useMemo, useState } from 'react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { schedeClienti, concentrazione, GIUDIZI } from '../lib/analytics'
import { euro, pct, dec, gg, numero, dataIt } from '../lib/format'
import { Carta, Kpi, Tabella, StrisciaPagamenti, coloriGrafico as C } from '../components/ui'

const FILTRI = [
  { id: 'tutti', nome: 'Tutti' },
  { id: 'ottimo', nome: 'Eccellenti' },
  { id: 'buono', nome: 'Affidabili' },
  { id: 'attenzione', nome: 'Da monitorare' },
  { id: 'critico', nome: 'Critici' },
  { id: 'aperti', nome: 'Con posizioni aperte' }
]

export default function Clienti ({ righe }) {
  const [filtro, setFiltro] = useState('tutti')
  const [minimo, setMinimo] = useState(0)
  const [cerca, setCerca] = useState('')

  const clienti = useMemo(() => schedeClienti(righe), [righe])
  const conc = useMemo(() => concentrazione(clienti), [clienti])

  const visibili = useMemo(() => {
    const q = cerca.trim().toUpperCase()
    return clienti.filter((c) => {
      if (c.imponibile < minimo) return false
      if (q && !c.nome.toUpperCase().includes(q)) return false
      if (filtro === 'aperti') return c.documentiAperti > 0
      if (filtro !== 'tutti') return c.giudizio.tono === filtro
      return true
    })
  }, [clienti, filtro, minimo, cerca])

  const conteggi = useMemo(() => {
    const c = {}
    GIUDIZI.forEach((g) => { c[g.tono] = clienti.filter((x) => x.giudizio.tono === g.tono).length })
    return c
  }, [clienti])

  const totale = clienti.reduce((s, c) => s + c.imponibile, 0)
  const quotaAl = (n) => (conc[Math.min(n, conc.length) - 1]?.quota ?? 0)

  const cronici = clienti.filter((c) => c.profilo === 'cronico' && c.imponibile >= 1000)
  const episodici = clienti.filter((c) => c.profilo === 'episodico' && c.imponibile >= 1000)

  return (
    <div className="griglia" style={{ gap: 18 }}>
      <div className="griglia g4">
        <Kpi etichetta="Clienti nel periodo" valore={numero(clienti.length)}
             nota={`${euro(totale)} di imponibile`} />
        <Kpi etichetta="Eccellenti e affidabili"
             valore={numero((conteggi.ottimo || 0) + (conteggi.buono || 0))}
             nota={`su ${numero(clienti.length)} clienti`} />
        <Kpi etichetta="Da monitorare" valore={numero(conteggi.attenzione || 0)} tono="attenzione"
             nota="pagano tardi o hanno esposizione" />
        <Kpi etichetta="Critici" valore={numero(conteggi.critico || 0)} tono="critico"
             nota={`${euro(clienti.filter((c) => c.giudizio.tono === 'critico').reduce((s, c) => s + c.aperto, 0))} esposti`} />
      </div>

      <div className="griglia g2">
        <Carta titolo="Quanto pesano i primi clienti"
               didascalia="Quota cumulata del fatturato al crescere del numero di clienti.">
          <div style={{ height: 210 }}>
            <ResponsiveContainer>
              <AreaChart data={conc} margin={{ top: 6, right: 10, left: 0, bottom: 4 }}>
                <CartesianGrid stroke="#e7edf3" />
                <XAxis dataKey="posizione" tickLine={false} axisLine={{ stroke: '#dce6ef' }} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} width={40} />
                <Tooltip formatter={(v) => pct(v)} labelFormatter={(v) => `Primi ${v} clienti`} />
                <Area dataKey="quota" stroke={C.navy} strokeWidth={2} fill={C.petrolioChiaro} fillOpacity={0.45} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="didascalia" style={{ marginBottom: 0 }}>
            Primi 5: <b>{pct(quotaAl(5))}</b> · primi 10: <b>{pct(quotaAl(10))}</b> ·
            {' '}primi 20: <b>{pct(quotaAl(20))}</b> · primi 50: <b>{pct(quotaAl(50))}</b>
          </p>
        </Carta>

        <Carta titolo="Ritardatari abituali o incidenti isolati"
               didascalia="La differenza fra tempo medio e mediana separa chi paga sempre tardi da chi ha una sola pratica ferma.">
          <div className="griglia g3" style={{ gap: 10 }}>
            <Kpi etichetta="Ritardo abituale" valore={numero(cronici.length)} tono="critico"
                 nota="mediana oltre 30 giorni" />
            <Kpi etichetta="Ritardo isolato" valore={numero(episodici.length)} tono="attenzione"
                 nota="una posizione trascina la media" />
          </div>
          <p className="didascalia" style={{ marginTop: 12, marginBottom: 0 }}>
            I primi vanno affrontati rivedendo le condizioni di pagamento, magari con mandato RID.
            Per i secondi basta chiudere la singola posizione: cambiare le condizioni sarebbe
            sproporzionato e rischierebbe di irritare un cliente che paga bene.
          </p>
        </Carta>
      </div>

      <Carta
        titolo="Scheda clienti"
        didascalia="Il punteggio combina velocità di pagamento (45%), quota di fatturato ancora aperta (35%) e anzianità della posizione più vecchia (20%)."
        azioni={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="text" placeholder="Cerca cliente" value={cerca}
                   onChange={(e) => setCerca(e.target.value)} style={{ width: 170 }} aria-label="Cerca cliente" />
            <select value={minimo} onChange={(e) => setMinimo(Number(e.target.value))}
                    aria-label="Fatturato minimo" style={{ width: 168 }}>
              <option value={0}>Tutti gli importi</option>
              <option value={500}>Da € 500</option>
              <option value={1500}>Da € 1.500</option>
              <option value={5000}>Da € 5.000</option>
            </select>
          </div>
        }
      >
        <div className="filtri" style={{ marginBottom: 12 }}>
          <div className="gruppo">
            {FILTRI.map((f) => (
              <button key={f.id} aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}>{f.nome}</button>
            ))}
          </div>
        </div>

        <Tabella
          ordineIniziale="imponibile"
          chiave={(c) => c.key}
          vuoto="Nessun cliente corrisponde ai filtri impostati."
          righe={visibili}
          colonne={[
            { id: 'nome', titolo: 'Cliente', render: (c) => <span className="nome-cliente" title={c.nome}>{c.nome}</span> },
            {
              id: 'punteggio',
              titolo: 'Giudizio',
              render: (c) => <span className={`pillola ${c.giudizio.tono}`}>{c.giudizio.nome} · {c.punteggio}</span>
            },
            {
              id: 'ritmo',
              titolo: 'Ritmo di pagamento',
              ordinabile: false,
              render: (c) => (
                <StrisciaPagamenti
                  tempi={c.tempi}
                  aperti={c.righe.filter((r) => !r.incassata).map((r) => r.ggAperti)}
                />
              )
            },
            { id: 'documenti', titolo: 'Doc.', num: true, render: (c) => numero(c.documenti) },
            { id: 'imponibile', titolo: 'Imponibile', num: true, render: (c) => euro(c.imponibile) },
            { id: 'dso', titolo: 'Tempo medio', num: true, render: (c) => gg(c.dso) },
            { id: 'mediana', titolo: 'Mediana', num: true, render: (c) => gg(c.mediana) },
            {
              id: 'aperto',
              titolo: 'Aperto',
              num: true,
              render: (c) => (c.aperto > 0
                ? <span className="giu">{euro(c.aperto)}</span>
                : <span style={{ color: 'var(--grigio-chiaro)' }}>—</span>)
            },
            {
              id: 'apertoMax',
              titolo: 'Da giorni',
              num: true,
              render: (c) => (c.apertoMax === null ? '—' : numero(c.apertoMax))
            },
            { id: 'ultimo', titolo: 'Ultimo doc.', num: true, render: (c) => dataIt(c.ultimo) }
          ]}
        />
        <p className="didascalia" style={{ marginTop: 12, marginBottom: 0 }}>
          Nel <b>ritmo di pagamento</b> ogni tacca è una fattura, collocata secondo i giorni impiegati per
          incassarla; le tratteggiate rosse sono le posizioni ancora aperte. Le tacche riferite alla soglia
          dei 15, 30 e 60 giorni.
        </p>
      </Carta>
    </div>
  )
}
