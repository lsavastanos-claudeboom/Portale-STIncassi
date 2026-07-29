import React, { useMemo } from 'react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Cell
} from 'recharts'
import {
  curvaIncasso, orizzonteUtile, fasceIncasso, anzianitaCredito, tempisticheFamiglia, indicatori
} from '../lib/analytics'
import { euro, pct, dec, gg, numero, dataIt } from '../lib/format'
import { Carta, Kpi, Tabella, coloriGrafico as C } from '../components/ui'

export default function Tempistiche ({ righe }) {
  const anni = useMemo(() => [...new Set(righe.map((r) => r.anno))].sort(), [righe])

  /* Tutti gli anni vanno giudicati sulla stessa scadenza, altrimenti
     l'anno in corso verrebbe misurato su una coorte più piccola e diversa. */
  const { curve, orizzonte, coorte } = useMemo(() => {
    const perAnno = anni.map((a) => righe.filter((r) => r.anno === a))
    const orizzonti = perAnno.map((rr) => orizzonteUtile(rr)).filter((x) => x !== null)
    if (!orizzonti.length) return { curve: [], orizzonte: null, coorte: 0 }
    const o = Math.min(...orizzonti)
    const punti = perAnno.map((rr) => curvaIncasso(rr, { orizzonte: o }))
    const tappe = punti.find((p) => p.length)?.map((p) => p.giorni) || []
    return {
      orizzonte: o,
      coorte: punti.reduce((s, p) => s + (p[0]?.documenti || 0), 0),
      curve: tappe.map((g, i) => {
        const p = { giorni: g }
        anni.forEach((a, j) => { p[a] = punti[j][i]?.quota ?? null })
        return p
      })
    }
  }, [righe, anni])

  const fasce = useMemo(() => {
    const perAnno = anni.map((a) => ({ anno: a, dati: fasceIncasso(righe.filter((r) => r.anno === a)) }))
    const base = fasceIncasso(righe)
    return base.map((f, i) => {
      const p = { fascia: f.fascia }
      perAnno.forEach(({ anno, dati }) => { p[anno] = dati[i]?.quota ?? 0 })
      return p
    })
  }, [righe, anni])

  const anzianita = useMemo(() => anzianitaCredito(righe), [righe])
  const famiglie = useMemo(() => tempisticheFamiglia(righe), [righe])
  const k = useMemo(() => indicatori(righe), [righe])
  const aperte = useMemo(() => righe.filter((r) => !r.incassata), [righe])

  const coloreAnzianita = ['#17838c', '#4aa8b0', '#8fc3d6', '#e8b54d', '#c0504d', '#8e2f2c']

  return (
    <div className="griglia" style={{ gap: 18 }}>
      <div className="griglia g4">
        <Kpi etichetta="Tempo medio ponderato" valore={gg(k.dso)}
             nota="pesato sull'imponibile di ogni documento" />
        <Kpi etichetta="Tempo mediano" valore={gg(k.dsoMediano)}
             nota="metà delle fatture rientra entro" />
        <Kpi etichetta="Credito aperto" valore={euro(k.aperto)}
             nota={`${numero(k.documentiAperti)} documenti`} />
        <Kpi etichetta="Quota incassata" valore={pct(k.quotaIncassata)}
             nota="sull'imponibile emesso nel periodo" />
      </div>

      <Carta titolo="Quanto in fretta rientra il fatturato"
             didascalia={orizzonte === null
               ? 'Percentuale cumulata di imponibile incassato entro un dato numero di giorni.'
               : `Percentuale cumulata di imponibile incassato entro un dato numero di giorni. Ogni anno è misurato sui soli documenti emessi da almeno ${orizzonte} giorni (${numero(coorte)} in tutto), così il confronto è alla pari.`}>
        <div style={{ height: 290 }}>
          <ResponsiveContainer>
            <LineChart data={curve} margin={{ top: 6, right: 12, left: 4, bottom: 4 }}>
              <CartesianGrid stroke="#e7edf3" />
              <XAxis dataKey="giorni" tickLine={false} axisLine={{ stroke: '#dce6ef' }}
                     label={{ value: 'giorni dalla data proforma', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#7c8a9a' }} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} width={42} />
              <Tooltip formatter={(v) => pct(v)} labelFormatter={(v) => `Entro ${v} giorni`} />
              <Legend iconType="line" wrapperStyle={{ fontSize: 12.5 }} />
              {anni.map((a, i) => (
                <Line key={a} dataKey={a} name={String(a)}
                      stroke={[C.petrolioChiaro, C.navy, C.petrolio, C.oro][i % 4]}
                      strokeWidth={2.2} dot={{ r: 2.5 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Carta>

      <div className="griglia g2">
        <Carta titolo="Distribuzione dei tempi di incasso"
               didascalia="Quota dell'imponibile incassato per fascia di giorni, anno per anno.">
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={fasce} margin={{ top: 6, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid stroke="#e7edf3" vertical={false} />
                <XAxis dataKey="fascia" tickLine={false} axisLine={{ stroke: '#dce6ef' }} fontSize={11} />
                <YAxis tickFormatter={(v) => `${Math.round(v)}%`} tickLine={false} axisLine={false} width={40} />
                <Tooltip formatter={(v) => pct(v)} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12.5 }} />
                {anni.map((a, i) => (
                  <Bar key={a} dataKey={a} name={String(a)}
                       fill={[C.petrolioChiaro, C.navy, C.petrolio, C.oro][i % 4]}
                       radius={[3, 3, 0, 0]} maxBarSize={30} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Carta>

        <Carta titolo="Anzianità del credito aperto"
               didascalia="Imponibile non ancora incassato, per età del documento.">
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={anzianita} margin={{ top: 6, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid stroke="#e7edf3" vertical={false} />
                <XAxis dataKey="fascia" tickLine={false} axisLine={{ stroke: '#dce6ef' }} fontSize={11} />
                <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} tickLine={false} axisLine={false} width={42} />
                <Tooltip formatter={(v, n, p) => [`${euro(v)} · ${p.payload.documenti} doc.`, 'Aperto']} />
                <Bar dataKey="importo" radius={[3, 3, 0, 0]} maxBarSize={46}>
                  {anzianita.map((_, i) => <Cell key={i} fill={coloreAnzianita[i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Carta>
      </div>

      <Carta titolo="Quali prestazioni assorbono cassa"
             didascalia="Ogni documento è attribuito alla famiglia della voce di importo prevalente.">
        <Tabella
          ordineIniziale="imponibile"
          chiave={(r) => r.nome}
          righe={famiglie}
          colonne={[
            { id: 'nome', titolo: 'Famiglia di prestazione' },
            { id: 'documenti', titolo: 'Doc.', num: true, render: (r) => numero(r.documenti) },
            { id: 'imponibile', titolo: 'Imponibile', num: true, render: (r) => euro(r.imponibile) },
            { id: 'dso', titolo: 'Tempo medio', num: true, render: (r) => gg(r.dso) },
            { id: 'mediana', titolo: 'Mediana', num: true, render: (r) => gg(r.mediana) },
            {
              id: 'quotaAperta',
              titolo: 'Ancora aperto',
              num: true,
              render: (r) => (
                <span className={r.quotaAperta > 25 ? 'giu' : r.quotaAperta > 10 ? '' : 'su'}>
                  {pct(r.quotaAperta)}
                </span>
              )
            }
          ]}
        />
      </Carta>

      <Carta titolo="Posizioni ancora aperte"
             didascalia={`${numero(aperte.length)} documenti senza data di incasso, dai più vecchi.`}>
        <Tabella
          ordineIniziale="ggAperti"
          chiave={(r) => `${r.studio}${r.sezionale}${r.n_doc}${r.data_doc}`}
          vuoto="Nessuna posizione aperta: tutto il periodo risulta incassato."
          righe={aperte}
          colonne={[
            { id: 'n_doc', titolo: 'N. doc.' },
            { id: 'sezionale', titolo: 'Sez.', render: (r) => <span className="pillola neutro">{r.sezionale}</span> },
            { id: 'cliente', titolo: 'Cliente', render: (r) => <span className="nome-cliente">{r.cliente}</span> },
            { id: 'data_doc', titolo: 'Data', num: true, render: (r) => dataIt(r.data_doc) },
            { id: 'imponibile', titolo: 'Imponibile', num: true, render: (r) => euro(r.imponibile) },
            { id: 'totale', titolo: 'Lordo', num: true, render: (r) => euro(r.totale) },
            {
              id: 'ggAperti',
              titolo: 'Giorni aperti',
              num: true,
              render: (r) => (
                <span className={r.ggAperti > 180 ? 'giu' : r.ggAperti > 90 ? '' : ''}>
                  {numero(r.ggAperti)}
                </span>
              )
            }
          ]}
        />
      </Carta>
    </div>
  )
}
