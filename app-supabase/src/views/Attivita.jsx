import React, { useMemo, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell
} from 'recharts'
import { ripartizioneAttivita, variazione } from '../lib/analytics'
import { euro, pct, numero } from '../lib/format'
import { Carta, Tabella, Variazione, coloriGrafico as C } from '../components/ui'

export default function Attivita ({ righe }) {
  const [dettaglio, setDettaglio] = useState(false)
  const anni = useMemo(() => [...new Set(righe.map((r) => r.anno))].sort(), [righe])

  const famiglie = useMemo(() => ripartizioneAttivita(righe, { perFamiglia: true }), [righe])
  const voci = useMemo(() => ripartizioneAttivita(righe, { perFamiglia: false }), [righe])
  const dati = dettaglio ? voci : famiglie

  const grafico = useMemo(() => {
    const totPerAnno = {}
    anni.forEach((a) => {
      totPerAnno[a] = famiglie.reduce((s, f) => s + (f.anni[a] || 0), 0) || 1
    })
    return [...famiglie]
      .sort((a, b) => a.importo - b.importo)
      .map((f) => {
        const p = { nome: f.nome }
        anni.forEach((a) => { p[a] = ((f.anni[a] || 0) / totPerAnno[a]) * 100 })
        return p
      })
  }, [famiglie, anni])

  const primo = anni[anni.length - 2]
  const secondo = anni[anni.length - 1]
  const tot = famiglie.reduce((s, f) => s + f.importo, 0)
  const top = famiglie[0]

  return (
    <div className="griglia" style={{ gap: 18 }}>
      {top && (
        <div className="rilievo petrolio">
          <h3>Composizione del fatturato</h3>
          <p>
            <b>{top.nome}</b> vale il {pct(top.quota)} del totale ({euro(top.importo)} su {euro(tot)}).
            Le prime tre famiglie coprono
            {' '}<b>{pct(famiglie.slice(0, 3).reduce((s, f) => s + f.quota, 0))}</b> del fatturato:
            {famiglie.slice(0, 3).reduce((s, f) => s + f.quota, 0) > 75
              ? ' la base di ricavo è concentrata, quindi vale la pena presidiare le condizioni di rinnovo su queste linee.'
              : ' la base di ricavo è distribuita su più linee di servizio.'}
          </p>
        </div>
      )}

      <Carta titolo="Peso di ciascuna famiglia, anno per anno"
             didascalia="Quota percentuale sul fatturato dell'anno. Le voci negative dell'export (storni e sconti) sono escluse dal calcolo della composizione.">
        <div style={{ height: 30 + grafico.length * 34 }}>
          <ResponsiveContainer>
            <BarChart data={grafico} layout="vertical" margin={{ top: 4, right: 40, left: 4, bottom: 4 }}>
              <CartesianGrid stroke="#e7edf3" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => `${Math.round(v)}%`} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="nome" width={190} tickLine={false}
                     axisLine={{ stroke: '#dce6ef' }} fontSize={11.5} />
              <Tooltip formatter={(v) => pct(v)} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12.5 }} />
              {anni.map((a, i) => (
                <Bar key={a} dataKey={a} name={String(a)}
                     fill={[C.petrolioChiaro, C.navy, C.petrolio, C.oro][i % 4]}
                     radius={[0, 3, 3, 0]} maxBarSize={16} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Carta>

      <Carta
        titolo={dettaglio ? 'Dettaglio per singola voce' : 'Dettaglio per famiglia'}
        didascalia="Importi ricostruiti dalle colonne di dettaglio dell'export."
        azioni={
          <button className="bottone secondario piccolo" onClick={() => setDettaglio(!dettaglio)}>
            {dettaglio ? 'Raggruppa per famiglia' : 'Apri le singole voci'}
          </button>
        }
      >
        <Tabella
          ordineIniziale="importo"
          chiave={(r) => r.nome}
          righe={dati}
          colonne={[
            { id: 'nome', titolo: dettaglio ? 'Voce' : 'Famiglia' },
            ...anni.map((a) => ({
              id: `anno${a}`,
              titolo: String(a),
              num: true,
              valore: (r) => r.anni[a] || 0,
              render: (r) => euro(r.anni[a] || 0)
            })),
            { id: 'importo', titolo: 'Totale', num: true, render: (r) => euro(r.importo) },
            { id: 'quota', titolo: 'Quota', num: true, render: (r) => pct(r.quota) },
            ...(primo && secondo
              ? [{
                  id: 'var',
                  titolo: `${primo} → ${secondo}`,
                  num: true,
                  valore: (r) => variazione(r.anni[secondo] || 0, r.anni[primo] || 0) ?? -9999,
                  render: (r) => <Variazione valore={variazione(r.anni[secondo] || 0, r.anni[primo] || 0)} />
                }]
              : []),
            { id: 'documenti', titolo: 'Doc.', num: true, render: (r) => numero(r.documenti) }
          ]}
        />
      </Carta>
    </div>
  )
}
