import React, { useState } from 'react'
import { supabase, configurato } from '../lib/supabase'

export default function Accesso () {
  const [modo, setModo] = useState('entra')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errore, setErrore] = useState(null)
  const [stato, setStato] = useState(null)
  const [inCorso, setInCorso] = useState(false)

  async function invia (e) {
    e.preventDefault()
    setErrore(null); setStato(null); setInCorso(true)
    try {
      if (modo === 'entra') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setStato('Account creato. Se il progetto richiede la conferma via email, controlla la casella prima di entrare.')
      }
    } catch (err) {
      setErrore(
        /invalid login/i.test(err.message)
          ? 'Email o password non corrispondono.'
          : /already registered/i.test(err.message)
            ? 'Questa email è già registrata: usa "Ho già un accesso".'
            : err.message
      )
    } finally {
      setInCorso(false)
    }
  }

  if (!configurato) {
    return (
      <div className="accesso">
        <div className="riquadro">
          <div className="marchio-grande">Portale Incassi</div>
          <div className="sotto">Configurazione mancante</div>
          <div className="errore">
            Le variabili <b>VITE_SUPABASE_URL</b> e <b>VITE_SUPABASE_ANON_KEY</b> non sono impostate.
            Copia <b>.env.example</b> in <b>.env</b>, inserisci i valori del progetto Supabase e riavvia.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="accesso">
      <div className="riquadro">
        <div className="marchio-grande">Portale Incassi</div>
        <div className="sotto">Studi Riuniti · TecnAccise</div>

        <form onSubmit={invia}>
          <label className="campo">
            <span>Email</span>
            <input type="email" value={email} required autoComplete="username"
                   onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="campo">
            <span>Password</span>
            <input type="password" value={password} required minLength={8}
                   autoComplete={modo === 'entra' ? 'current-password' : 'new-password'}
                   onChange={(e) => setPassword(e.target.value)} />
          </label>

          {errore && <div className="errore" style={{ marginBottom: 12 }}>{errore}</div>}
          {stato && <div className="riuscito" style={{ marginBottom: 12 }}>{stato}</div>}

          <button className="bottone" style={{ width: '100%' }} disabled={inCorso}>
            {inCorso ? <span className="caricando" /> : modo === 'entra' ? 'Entra' : 'Crea l\'accesso'}
          </button>
        </form>

        <button className="alterna" onClick={() => { setModo(modo === 'entra' ? 'registra' : 'entra'); setErrore(null) }}>
          {modo === 'entra' ? 'Primo accesso? Crea un account' : 'Ho già un accesso'}
        </button>
      </div>
    </div>
  )
}
