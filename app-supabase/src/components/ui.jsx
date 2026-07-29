import React, { useState, useMemo } from 'react'
import { euro, pct, segno } from '../lib/format'

export function Kpi ({ etichetta, valore, nota, tono }) {
  return (
    <div className={`kpi ${tono || ''}`}>
      <div className="etichetta">{etichetta}</div>
      <div className="valore">{valore}</div>
      {nota && <div className="nota">{nota}</div>}
    </div>
  )
}

export function Carta ({ titolo, didascalia, azioni, children }) {
  return (
    <section className="carta">
      {(titolo || azioni) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            {titolo && <h3>{titolo}</h3>}
            {didascalia && <p className="didascalia">{didascalia}</p>}
          </div>
          {azioni}
        </div>
      )}
      {children}
    </section>
  )
}

export function Variazione ({ valore }) {
  if (valore === null || valore === undefined) return <span>—</span>
  return <span className={valore >= 0 ? 'su' : 'giu'}>{segno(valore)}</span>
}

export function Vuoto ({ titolo, testo, azione }) {
  return (
    <div className="vuoto">
      <h3>{titolo}</h3>
      <p>{testo}</p>
      {azione}
    </div>
  )
}

/**
 * Striscia del comportamento di pagamento.
 * Ogni tacca è una fattura incassata, posizionata sui giorni impiegati.
 * Le tacche ammassate a sinistra sono un cliente che paga a vista; una
 * coda verso destra racconta un ritardo abituale; le tacche rosse in
 * fondo sono le posizioni ancora aperte.
 */
export function StrisciaPagamenti ({ tempi = [], aperti = [], larghezza = 132, altezza = 26, max = 120 }) {
  const scala = (g) => 3 + (Math.min(g, max) / max) * (larghezza - 6)
  const soglie = [15, 30, 60]
  return (
    <svg className="striscia" width={larghezza} height={altezza} viewBox={`0 0 ${larghezza} ${altezza}`}
         role="img"
         aria-label={`Tempi di incasso: ${tempi.length} fatture saldate, ${aperti.length} ancora aperte`}>
      <rect className="fondo" x="0" y={altezza / 2 - 6} width={larghezza} height="12" rx="6" />
      {soglie.map((s) => (
        <line key={s} className="soglia" x1={scala(s)} y1={altezza / 2 - 7} x2={scala(s)} y2={altezza / 2 + 7} />
      ))}
      {tempi.map((g, i) => (
        <line key={`t${i}`} className="tacca"
              x1={scala(g)} y1={altezza / 2 - 5} x2={scala(g)} y2={altezza / 2 + 5}
              stroke={g <= 7 ? '#17838c' : g <= 30 ? '#4aa8b0' : g <= 60 ? '#e8b54d' : '#c0504d'}
              opacity={0.85} />
      ))}
      {aperti.map((g, i) => (
        <line key={`a${i}`} className="tacca"
              x1={scala(g)} y1={altezza / 2 - 8} x2={scala(g)} y2={altezza / 2 + 8}
              stroke="#c0504d" strokeDasharray="2 1.5" opacity={0.9} />
      ))}
    </svg>
  )
}

/** Tabella ordinabile con colonne dichiarative. */
export function Tabella ({ colonne, righe, ordineIniziale, chiave, vuoto = 'Nessun dato.' }) {
  const [ordine, setOrdine] = useState(ordineIniziale || colonne[0].id)
  const [disc, setDisc] = useState(true)

  const ordinate = useMemo(() => {
    const col = colonne.find((c) => c.id === ordine)
    if (!col) return righe
    const v = col.valore || ((r) => r[col.id])
    return [...righe].sort((a, b) => {
      const x = v(a); const y = v(b)
      if (x === null || x === undefined) return 1
      if (y === null || y === undefined) return -1
      const c = typeof x === 'string' ? x.localeCompare(y, 'it') : x - y
      return disc ? -c : c
    })
  }, [righe, ordine, disc, colonne])

  if (!righe.length) return <div className="vuoto"><p>{vuoto}</p></div>

  return (
    <div className="tabella-scorri">
      <table>
        <thead>
          <tr>
            {colonne.map((c) => (
              <th key={c.id}
                  className={`${c.num ? 'num' : ''} ${c.ordinabile === false ? '' : 'ordinabile'}`}
                  onClick={() => {
                    if (c.ordinabile === false) return
                    if (ordine === c.id) setDisc(!disc); else { setOrdine(c.id); setDisc(true) }
                  }}
                  scope="col">
                {c.titolo}{ordine === c.id ? (disc ? ' ↓' : ' ↑') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ordinate.map((r, i) => (
            <tr key={chiave ? chiave(r) : i}>
              {colonne.map((c) => (
                <td key={c.id} className={c.num ? 'num' : ''}>
                  {c.render ? c.render(r) : (c.valore ? c.valore(r) : r[c.id])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export const coloriGrafico = {
  navy: '#1f3a5f',
  petrolio: '#17838c',
  petrolioChiaro: '#8fc3d6',
  oro: '#e8b54d',
  argilla: '#c0504d',
  verde: '#2f8f6b',
  grigio: '#a7b3c0'
}

export const tooltipEuro = (v) => euro(v)
export const tooltipPct = (v) => pct(v)
