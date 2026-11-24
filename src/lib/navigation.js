const HOME_URL = '/pages/index/index'
const COMPOSE_URL = '/pages/compose/index'
const DETAIL_URL = '/pages/detail/index'

export function showNotice(message) {
  uni.showToast({ title: message, icon: 'none', duration: 2200 })
}

export function openHome(tab = 'feed') {
  uni.reLaunch({ url: `${HOME_URL}?tab=${encodeURIComponent(tab)}` })
}

export function goBack() {
  if (getCurrentPages().length > 1) uni.navigateBack()
  else openHome()
}

function pushPage(url, replace) {
  const options = { url, fail: () => showNotice('暂时无法打开页面，请重试') }
  if (replace) uni.redirectTo(options)
  else uni.navigateTo(options)
}

export function openCompose() {
  pushPage(COMPOSE_URL)
}

export function detailPath(id) {
  return `${DETAIL_URL}?id=${encodeURIComponent(id)}`
}

export function openDetail(id, replace = false) {
  pushPage(detailPath(id), replace)
}

export async function shareDetail(id) {
  // #ifdef H5
  const host = `${window.location.origin}${window.location.pathname}${window.location.search}`
  const url = `${host}#${detailPath(id)}`
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url)
    else await new Promise((resolve, reject) => uni.setClipboardData({ data: url, showToast: false, success: resolve, fail: reject }))
    showNotice('链接已复制')
  } catch {
    showNotice('复制失败，请从地址栏复制链接')
  }
  // #endif
}
