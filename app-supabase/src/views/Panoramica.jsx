import React, { useMemo } from 'react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts'
import {
  indicatori, serieMensile, confrontoAnni, variazione, effettoRid,
  schedeClienti, anzianitaCredito, giornoDellAnno
} from '../lib/analytics'
import { euro, pct, dec, gg, numero } from '../lib/format'
import { Kpi, Carta, Variazione, coloriGrafico as C } from '../components/ui'

export default function Panoramica ({ righe, dataRiferimento }) {
  const k = useMemo(() => indicatori(righe), [righe])
  const serie = useMemo(() => serieMensile(righe), [righe])
  const rid = useMemo(() => effettoRid(righe), [righe])
  const anzianita = useMemo(() => anzianitaCredito(righe), [righe])
  const clienti = useMemo(() => schedeClienti(righe), [righe])

  const doy = giornoDellAnno(dataRiferimento)
  const anni = useMemo(() => confrontoAnni(righe, { finoAlGiorno: doy }), [righe, doy])
  const ultimo = anni[anni.length - 1]
  const penultimo = anni[anni.length - 2]

  const oltre90 = anzianita.slice(3).reduce((s, f) => s + f.importo, 0)
  const doc90 = anzianita.slice(3).reduce((s, f) => s + f.documenti, 0)
  const critici = clienti.filter((c) => c.giudizio.tono === 'critico')
  const guadagnoRid = rid.senza.dso !== null && rid.con.dso !== null
    ? rid.senza.dso - rid.con.dso
    : null

  return (
    <div className="griglia" style={{ gap: 18 }}>
      <div className="griglia g4">
        <Kpi etichetta="Imponibile emesso" valore={euro(k.imponibile)}
             nota={`${numero(k.documenti)} proforma · ${numero(k.clienti)} clienti`} />
        <Kpi etichetta="Incassato" valore={pct(k.quotaIncassata)}
             nota={`${euro(k.incassato)} su ${euro(k.imponibile)}`} />
        <Kpi etichetta="Tempo medio di incasso" valore={gg(k.dso)}
             nota={`mediana ${dec(k.dsoMediano)} gg`}
             tono={k.dso > 45 ? 'critico' : k.dso > 25 ? 'attenzione' : ''} />
        <Kpi etichetta="Credito aperto" valore={euro(k.aperto)}
             nota={`${euro(k.apertoLordo)} lordi · ${numero(k.documentiAperti)} doc.`}
             tono={oltre90 > k.aperto * 0.35 ? 'attenzione' : ''} />
      </div>

      {penultimo && ultimo && (
        <div className="rilievo">
          <h3>Confronto a parità di periodo</h3>
          <p>
            Dal 1° gennaio alla stessa data, il {ultimo.anno} vale <b>{euro(ultimo.imponibile)}</b> contro
            i {euro(penultimo.imponibile)} del {penultimo.anno}
            {' '}(<Variazione valore={variazione(ultimo.imponibile, penultimo.imponibile)} /> di imponibile,
            {' '}<Variazione valore={variazione(ultimo.documenti, penultimo.documenti)} /> di documenti).
            Il tempo medio di incasso è passato da <b>{dec(penultimo.dso)}</b> a <b>{dec(ultimo.dso)} giorni</b>.
            {ultimo.dso !== null && penultimo.dso !== null && (
              ultimo.dso < penultimo.dso
                ? ' Volumi e circolante si muovono nella stessa direzione: è il segnale che la crescita non sta avvenendo a scapito della cassa.'
                : ' I tempi si stanno allungando insieme ai volumi: vale la pena verificare quali linee di attività stiano assorbendo cassa.'
            )}
          </p>
        </div>
      )}

      <Carta titolo="Emesso e incassato, mese per mese"
             didascalia="Le barre seguono la data del documento, la linea la data di incasso effettiva.">
        <div style={{ height: 300 }}>
          <ResponsiveContainer>
            <ComposedChart data={serie} margin={{ top: 6, right: 8, left: 4, bottom: 4 }}>
              <CartesianGrid stroke="#e7edf3" vertical={false} />
              <XAxis dataKey="etichetta" interval="preserveStartEnd" tickLine={false} axisLine={{ stroke: '#dce6ef' }} />
              <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} tickLine={false} axisLine={false} width={44} />
              <Tooltip formatter={(v, n) => [euro(v), n]} labelStyle={{ fontWeight: 600 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12.5 }} />
              <Bar dataKey="emesso" name="Emesso" fill={C.navy} radius={[3, 3, 0, 0]} maxBarSize={26} />
              <Line dataKey="incassato" name="Incassato" stroke={C.petrolio} strokeWidth={2.2} dot={{ r: 2.5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Carta>

      <div className="griglia g2">
        <Carta titolo="Il mandato RID è la leva più forte"
               didascalia="Confronto fra le proforma con addebito automatico e tutte le altre.">
          <div className="griglia g3" style={{ gap: 10 }}>
            <div className="kpi" style={{ borderTopColor: C.petrolio }}>
              <div className="etichetta">Con RID</div>
              <div className="valore">{gg(rid.con.dso)}</div>
              <div className="nota">{euro(rid.con.imponibile)} · aperto {pct(rid.con.quotaAperta)}</div>
            </div>
            <div className="kpi critico">
              <div className="etichetta">Senza RID</div>
              <div className="valore">{gg(rid.senza.dso)}</div>
              <div className="nota">{euro(rid.senza.imponibile)} · aperto {pct(rid.senza.quotaAperta)}</div>
            </div>
          </div>
          {guadagnoRid !== null && guadagnoRid > 3 && (
            <p className="didascalia" style={{ marginTop: 12, marginBottom: 0 }}>
              A parità di importo, il mandato di addebito vale circa <b>{dec(guadagnoRid)} giorni</b> di
              circolante. Estenderlo alle prestazioni annuali è l'intervento con il ritorno più immediato.
            </p>
          )}
        </Carta>

        <Carta titolo="Dove si concentra il rischio"
               didascalia="Posizioni aperte per anzianità e clienti con profilo critico.">
          <div className="griglia g3" style={{ gap: 10 }}>
            <Kpi etichetta="Oltre 90 giorni" valore={euro(oltre90)} nota={`${numero(doc90)} documenti`}
                 tono="critico" />
            <Kpi etichetta="Clienti critici" valore={numero(critici.length)}
                 nota={`${euro(critici.reduce((s, c) => s + c.aperto, 0))} esposti`}
                 tono="attenzione" />
          </div>
          {critici.length > 0 && (
            <ul style={{ margin: '14px 0 0', paddingLeft: 18, fontSize: 13, color: 'var(--navy-tenue)' }}>
              {critici.slice(0, 4).map((c) => (
                <li key={c.key} style={{ marginBottom: 4 }}>
                  <b>{c.nome}</b> — {euro(c.aperto)} aperti
                  {c.apertoMax !== null && `, fino a ${numero(c.apertoMax)} gg`}
                </li>
              ))}
            </ul>
          )}
        </Carta>
      </div>
    </div>
  )
}
