import { reactive } from 'vue'
import { money } from './format.js'

const TOKEN_KEY = 'maibu-mai:cloud-session:v1'
const RETRYABLE_CREATES = new Set(['createCase', 'createGroup', 'addLedger'])
const CASE_MUTATIONS = new Set(['vote', 'comment', 'review', 'report', 'enableUrgent'])
let court

function createSession() {
  return {
    state: reactive({ userId: '', cases: [], groups: [], ledger: [], pending: false, error: '' }),
    token: uni.getStorageSync(TOKEN_KEY) || '',
    queue: Promise.resolve(),
    unresolved: new Map(),
  }
}

// Requests run one at a time so a refresh never overtakes the write it follows.
function enqueue(session, run) {
  const pending = session.queue.then(run)
  session.queue = pending.catch(() => {})
  return pending
}

async function callCloud(session, action, payload, requestId) {
  if (typeof uniCloud === 'undefined') throw new Error('此构建未关联 uniCloud 服务空间')
  let response
  try {
    response = await uniCloud.callFunction({ name: 'buy-or-not', data: { action, token: session.token || undefined, payload, requestId } })
  } catch {
    throw new Error('无法连接裁判所，请检查网络后再试')
  }
  return response?.result
}

function forgetIdentity(session, message) {
  const { state } = session
  session.token = ''
  uni.removeStorageSync(TOKEN_KEY)
  session.unresolved.clear()
  state.userId = ''
  state.cases = []
  state.groups = []
  state.ledger = []
  state.error = message
}

function applySnapshot(session, action, payload, data) {
  const { state } = session
  if (data.token) {
    session.token = data.token
    uni.setStorageSync(TOKEN_KEY, session.token)
  }
  state.userId = data.userId
  if (data.refreshRequired) {
    const caseId = action === 'createCase' ? data.result?.id : CASE_MUTATIONS.has(action) ? payload.id : undefined
    void refresh(session, caseId)
  } else {
    state.cases = data.cases
    state.groups = data.groups
    state.ledger = data.ledger
  }
  state.error = ''
}

async function request(session, action, payload, requestId) {
  const data = await callCloud(session, action, payload, requestId)
  if (data?.ok === true || (data?.ok === false && data.code !== 'SERVER_ERROR')) session.unresolved.delete(action)
  if (data?.ok !== true) {
    if (data?.code === 'SESSION_INVALID') forgetIdentity(session, data.message)
    throw new Error(data?.message || '裁判所暂时无法处理请求，请稍后再试')
  }
  applySnapshot(session, action, payload, data)
  return data.result
}

function refresh(session, caseId) {
  return enqueue(session, async () => {
    session.state.pending = true
    try {
      await request(session, 'bootstrap', caseId ? { caseId } : {})
    } catch (error) {
      session.state.error = error.message
    } finally {
      session.state.pending = false
    }
  })
}

// A create retried with the same fields reuses its request ID, so the server returns the record it already stored.
function createRequestId(session, action, payload) {
  const fields = JSON.stringify(payload)
  const previous = session.unresolved.get(action)
  const id = previous?.fields === fields
    ? previous.id
    : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`
  session.unresolved.set(action, { fields, id })
  return id
}

function mutate(session, action, payload) {
  return enqueue(session, async () => {
    if (!session.token) await request(session, 'bootstrap', {})
    if (!RETRYABLE_CREATES.has(action)) return request(session, action, payload)
    return request(session, action, payload, createRequestId(session, action, payload))
  })
}

export function useRemoteCourt() {
  if (court) return court
  const session = createSession()
  const { state } = session
  const send = (action, payload) => mutate(session, action, payload)

  court = {
    mode: 'cloud',
    get userId() { return state.userId },
    get cases() { return state.cases },
    get groups() { return state.groups },
    get ledger() { return state.ledger },
    get loading() { return state.pending && !state.userId },
    get error() { return state.error },
    money,
    refresh: (caseId) => refresh(session, caseId),
    createCase: (payload) => send('createCase', payload),
    vote: (id, side) => send('vote', { id, side }),
    comment: (id, text) => send('comment', { id, text }),
    review: (id, outcome) => send('review', { id, outcome }),
    joinGroup: (id) => send('joinGroup', { id }),
    checkIn: (id) => send('checkIn', { id }),
    createGroup: (payload) => send('createGroup', payload),
    report: (id, reason) => send('report', { id, reason }),
    enableUrgent: (id) => send('enableUrgent', { id }),
    addLedger: (payload) => send('addLedger', payload),
  }
  return court
}
