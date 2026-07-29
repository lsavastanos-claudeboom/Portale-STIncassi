const nfEuro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const nfEuroC = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })
const nfNum = new Intl.NumberFormat('it-IT')
const nfDec = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export const euro = (v) => (v === null || v === undefined || isNaN(v) ? '—' : nfEuro.format(v))
export const euroC = (v) => (v === null || v === undefined || isNaN(v) ? '—' : nfEuroC.format(v))
export const numero = (v) => (v === null || v === undefined || isNaN(v) ? '—' : nfNum.format(v))
export const dec = (v) => (v === null || v === undefined || isNaN(v) ? '—' : nfDec.format(v))
export const pct = (v) => (v === null || v === undefined || isNaN(v) ? '—' : `${nfDec.format(v)}%`)
export const gg = (v) => (v === null || v === undefined || isNaN(v) ? '—' : `${nfDec.format(v)} gg`)
export const segno = (v) => (v === null || v === undefined || isNaN(v) ? '—' : `${v > 0 ? '+' : ''}${nfDec.format(v)}%`)

export const dataIt = (d) => {
  if (!d) return '—'
  const [a, m, g] = String(d).slice(0, 10).split('-')
  return `${g}/${m}/${a}`
}
