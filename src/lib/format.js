export function money(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '0'
  const [whole, fraction = ''] = amount.toFixed(2).split('.')
  const integer = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const decimals = fraction.replace(/0+$/, '')
  return decimals ? `${integer}.${decimals}` : integer
}

export function relativeTime(timestamp, now = Date.now()) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  const minutes = Math.max(0, Math.floor((now - date.getTime()) / 60_000))
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (minutes < 1_440) return `${Math.floor(minutes / 60)} 小时前`
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`
}

export function localDateKey(timestamp) {
  const date = new Date(timestamp)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}
