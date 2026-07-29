import React, { useMemo, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts'
import {
  confrontoAnni, variazione, movimentiClienti, giornoDellAnno, MESI, ripartizioneAttivita
} from '../lib/analytics'
import { euro, pct, dec, gg, numero, dataIt } from '../lib/format'
import { Carta, Tabella, Variazione, Kpi, coloriGrafico as C } from '../components/ui'

export default function Confronti ({ righe, dataRiferimento }) {
  const [omogeneo, setOmogeneo] = useState(true)
  const doy = giornoDellAnno(dataRiferimento)

  const anni = useMemo(
    () => confrontoAnni(righe, { finoAlGiorno: omogeneo ? doy : null }),
    [righe, omogeneo, doy]
  )
  const a1 = anni[anni.length - 2]
  const a2 = anni[anni.length - 1]

  const movimenti = useMemo(
    () => (a1 && a2 ? movimentiClienti(righe, a1.anno, a2.anno) : null),
    [righe, a1, a2]
  )

  const perMese = useMemo(() => {
    const anniList = anni.map((a) => a.anno)
    return MESI.map((nome, i) => {
      const p = { mese: nome }
      anniList.forEach((a) => {
        p[a] = righe
          .filter((r) => r.anno === a && r.mese === i + 1)
          .reduce((s, r) => s + r.imponibile, 0)
      })
      return p
    })
  }, [righe, anni])

  const famiglie = useMemo(() => {
    if (!a1 || !a2) return []
    const f1 = ripartizioneAttivita(a1.righe, { perFamiglia: true })
    const f2 = ripartizioneAttivita(a2.righe, { perFamiglia: true })
    const nomi = [...new Set([...f1, ...f2].map((x) => x.nome))]
    return nomi.map((nome) => {
      const x = f1.find((v) => v.nome === nome)
      const y = f2.find((v) => v.nome === nome)
      return {
        nome,
        prima: x?.importo || 0,
        dopo: y?.importo || 0,
        quotaPrima: x?.quota || 0,
        quotaDopo: y?.quota || 0
      }
    }).sort((a, b) => b.dopo - a.dopo)
  }, [a1, a2])

  if (anni.length < 2) {
    return (
      <Carta titolo="Serve più di un esercizio">
        <p className="didascalia" style={{ marginBottom: 0 }}>
          L'archivio contiene un solo anno di proforma. Carica l'export di un esercizio
          precedente per attivare i confronti.
        </p>
      </Carta>
    )
  }

  const confronti = [
    { voce: 'Proforma emesse', v: (a) => a.documenti, f: numero },
    { voce: 'Imponibile', v: (a) => a.imponibile, f: euro },
    { voce: 'Totale lordo', v: (a) => a.totale, f: euro },
    { voce: 'Clienti attivi', v: (a) => a.clienti, f: numero },
    { voce: 'Ticket medio', v: (a) => a.ticketMedio, f: euro },
    { voce: 'Ticket mediano', v: (a) => a.ticketMediano, f: euro },
    { voce: 'Incassato su emesso', v: (a) => a.quotaIncassata, f: pct },
    { voce: 'Tempo medio di incasso', v: (a) => a.dso, f: gg },
    { voce: 'Tempo mediano di incasso', v: (a) => a.dsoMediano, f: gg },
    { voce: 'Credito ancora aperto', v: (a) => a.aperto, f: euro }
  ]

  return (
    <div className="griglia" style={{ gap: 18 }}>
      <div className="filtri">
        <div className="gruppo">
          <button aria-pressed={omogeneo} onClick={() => setOmogeneo(true)}>
            Finestra omogenea (1 gen – {dataIt(dataRiferimento).slice(0, 5)})
          </button>
          <button aria-pressed={!omogeneo} onClick={() => setOmogeneo(false)}>
            Anni interi
          </button>
        </div>
      </div>

      {omogeneo && (
        <div className="avviso">
          Confrontare un anno chiuso con uno in corso gonfia il divario. Con la finestra omogenea
          entrambi gli esercizi sono tagliati alla stessa data, così i volumi sono davvero comparabili.
        </div>
      )}

      <div className="griglia g4">
        <Kpi etichetta={`Imponibile ${a2.anno}`} valore={euro(a2.imponibile)}
             nota={`${a1.anno}: ${euro(a1.imponibile)}`} />
        <Kpi etichetta="Variazione"
             valore={<Variazione valore={variazione(a2.imponibile, a1.imponibile)} />}
             nota="imponibile su base omogenea" />
        <Kpi etichetta="Tempo medio di incasso" valore={gg(a2.dso)}
             nota={`era ${dec(a1.dso)} gg`}
             tono={a2.dso > a1.dso ? 'attenzione' : ''} />
        <Kpi etichetta="Ritenzione clienti" valore={pct(movimenti?.ritenzione)}
             nota={`${numero(movimenti?.mantenuti)} confermati · ${numero(movimenti?.nuovi)} nuovi`} />
      </div>

      <Carta titolo="Indicatori a confronto">
        <div className="tabella-scorri">
          <table>
            <thead>
              <tr>
                <th>Indicatore</th>
                {anni.map((a) => <th key={a.anno} className="num">{a.anno}</th>)}
                <th className="num">{a1.anno} → {a2.anno}</th>
              </tr>
            </thead>
            <tbody>
              {confronti.map((c) => {
                const inverso = c.voce.startsWith('Tempo') || c.voce.startsWith('Credito')
                const va = variazione(c.v(a2), c.v(a1))
                return (
                  <tr key={c.voce}>
                    <td>{c.voce}</td>
                    {anni.map((a) => <td key={a.anno} className="num">{c.f(c.v(a))}</td>)}
                    <td className="num">
                      {va === null ? '—' : (
                        <span className={(inverso ? -va : va) >= 0 ? 'su' : 'giu'}>
                          {va > 0 ? '+' : ''}{dec(va)}%
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="didascalia" style={{ marginTop: 10, marginBottom: 0 }}>
          Su tempi di incasso e credito aperto il verde indica una riduzione: sono voci in cui
          scendere è il risultato desiderato.
        </p>
      </Carta>

      <Carta titolo="Stagionalità a confronto"
             didascalia="Imponibile emesso mese per mese. I picchi seguono il calendario degli adempimenti.">
        <div style={{ height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={perMese} margin={{ top: 6, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid stroke="#e7edf3" vertical={false} />
              <XAxis dataKey="mese" tickLine={false} axisLine={{ stroke: '#dce6ef' }} />
              <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} tickLine={false} axisLine={false} width={42} />
              <Tooltip formatter={(v) => euro(v)} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12.5 }} />
              {anni.map((a, i) => (
                <Bar key={a.anno} dataKey={a.anno} name={String(a.anno)}
                     fill={[C.petrolioChiaro, C.navy, C.petrolio, C.oro][i % 4]}
                     radius={[3, 3, 0, 0]} maxBarSize={22} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Carta>

      <div className="griglia g2">
        <Carta titolo="Movimenti della base clienti"
               didascalia={`Confronto ${a1.anno} → ${a2.anno}.`}>
          <div className="tabella-scorri">
            <table>
              <tbody>
                <tr><td>Clienti confermati</td><td className="num">{numero(movimenti.mantenuti)}</td>
                    <td className="num">{euro(movimenti.imponibileMantenuti)}</td></tr>
                <tr><td>Nuovi clienti</td><td className="num">{numero(movimenti.nuovi)}</td>
                    <td className="num">{euro(movimenti.imponibileNuovi)}</td></tr>
                <tr><td>Clienti non più attivi</td><td className="num">{numero(movimenti.persi)}</td>
                    <td className="num">{euro(movimenti.imponibilePersi)}</td></tr>
              </tbody>
            </table>
          </div>
          <p className="didascalia" style={{ marginTop: 12, marginBottom: 0 }}>
            {movimenti.imponibileMantenuti > movimenti.imponibileNuovi * 3
              ? 'La crescita arriva soprattutto dall\'ampliamento del mandato sui clienti già in portafoglio, non dall\'acquisizione.'
              : 'L\'acquisizione contribuisce in misura rilevante al fatturato dell\'ultimo esercizio.'}
            {' '}Il fatturato dei clienti non più attivi va letto come base da recuperare, non come perdita certa:
            molti tornano con gli adempimenti annuali.
          </p>
        </Carta>

        <Carta titolo="Come si è spostato il mix"
               didascalia="Importi per famiglia nei due esercizi confrontati.">
          <Tabella
            ordineIniziale="dopo"
            chiave={(r) => r.nome}
            righe={famiglie}
            colonne={[
              { id: 'nome', titolo: 'Famiglia' },
              { id: 'prima', titolo: String(a1.anno), num: true, render: (r) => euro(r.prima) },
              { id: 'dopo', titolo: String(a2.anno), num: true, render: (r) => euro(r.dopo) },
              {
                id: 'quota',
                titolo: 'Quota',
                num: true,
                valore: (r) => r.quotaDopo,
                render: (r) => `${dec(r.quotaPrima)}% → ${dec(r.quotaDopo)}%`
              },
              {
                id: 'var',
                titolo: 'Var.',
                num: true,
                valore: (r) => variazione(r.dopo, r.prima) ?? -9999,
                render: (r) => <Variazione valore={variazione(r.dopo, r.prima)} />
              }
            ]}
          />
        </Carta>
      </div>
    </div>
  )
}
