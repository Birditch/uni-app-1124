'use strict'

const { actions } = require('./actions.js')
const { CourtError, hash } = require('./shared.js')
const { authenticate, snapshot } = require('./records.js')
const { requestIdPattern } = require('./validation.js')

exports.main = async (event = {}) => {
  const { action, token, payload: p = {}, requestId } = event ?? {}
  const operation = actions.get(action)
  const bootstrap = action === 'bootstrap'
  if ((!bootstrap && !operation) || !p || typeof p !== 'object' || Array.isArray(p)) {
    return { ok: false, code: 'VALIDATION', message: '无效的裁判所请求' }
  }
  if (requestId != null && (typeof requestId !== 'string' || !requestIdPattern.test(requestId))) {
    return { ok: false, code: 'VALIDATION', message: '无效的请求编号' }
  }

  try {
    const cloud = uniCloud
    const db = cloud.database()
    const identity = await authenticate(db, token, bootstrap)
    const { userId } = identity
    const now = Date.now()
    const requestRecordId = requestId ? hash(`${userId}:${action}:${requestId}`).slice(0, 32) : undefined
    const result = operation ? await operation({ db, cloud, userId, p, now, requestRecordId }) : undefined
    const response = { ok: true, ...identity, ...(result ? { result } : {}) }
    const caseId = p.caseId ?? (['vote', 'comment', 'review', 'enableUrgent', 'report'].includes(action) ? p.id : undefined)
    const groupId = ['joinGroup', 'checkIn'].includes(action) ? p.id : undefined
    try {
      return { ...response, ...await snapshot(db, userId, now, { caseId, groupId }) }
    } catch (error) {
      if (bootstrap) throw error
      console.error('Court refresh failed after write', { action, code: String(error.code ?? error.errCode ?? 'unknown') })
      return { ...response, refreshRequired: true }
    }
  } catch (error) {
    if (error instanceof CourtError) return { ok: false, code: error.code, message: error.message }
    console.error('Court operation failed', { action, code: String(error.code ?? error.errCode ?? 'unknown') })
    return { ok: false, code: 'SERVER_ERROR', message: '裁判所服务暂时繁忙，请稍后重试' }
  }
}
