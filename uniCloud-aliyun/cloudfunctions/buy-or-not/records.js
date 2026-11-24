'use strict'

const { randomBytes } = require('node:crypto')
const { collections, CourtError, hash, newId, localDay } = require('./shared.js')
const { tokenPattern, validRecordId, checkedId } = require('./validation.js')

async function document(database, collection, id) {
  const { data } = await database.collection(collection).doc(id).get()
  return Array.isArray(data) ? data[0] : data
}

async function existingCreate(db, collection, requestRecordId) {
  return requestRecordId ? document(db, collection, requestRecordId) : undefined
}

async function insertOnce(db, collection, entry, requestRecordId) {
  try {
    await db.collection(collection).add(entry)
    return entry
  } catch (error) {
    const existing = await existingCreate(db, collection, requestRecordId)
    if (!existing) throw error
    return existing
  }
}

async function transaction(db, write) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await db.startTransaction()
    try {
      const result = await write(current)
      await current.commit()
      return result
    } catch (error) {
      await current.rollback().catch(() => {})
      const conflict = Number(error.code) === 112 || /write[ -]?conflict|transaction[ -]?conflict|事务冲突/i.test(`${error.code} ${error.errCode} ${error.message}`)
      if (!conflict) throw error
      if (attempt === 3) throw new CourtError('BUSY', '操作暂时拥挤，请稍后再试')
      await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)))
    }
  }
}

async function authenticate(db, token, bootstrap) {
  if (bootstrap && token == null) {
    const freshToken = randomBytes(32).toString('hex')
    const userId = newId()
    await db.collection(collections.sessions).add({ _id: hash(freshToken), userId, createdAt: Date.now() })
    return { userId, token: freshToken }
  }

  if (typeof token === 'string' && tokenPattern.test(token)) {
    const session = await document(db, collections.sessions, hash(token))
    if (session?.userId) return { userId: session.userId }
  }

  throw new CourtError('SESSION_INVALID', '匿名身份已失效，请重新进入裁判所')
}

function projectCase(entry, userId) {
  const { _id, title, category, priceCents, budgetCents, reason, concern, alternative, image, urgent, buy, stop, comments, createdAt, authorId, review, reviewedAt, votes } = entry
  const own = authorId === userId
  return {
    id: _id, title, category, reason, concern, alternative, image,
    price: priceCents / 100,
    budget: budgetCents == null ? null : budgetCents / 100,
    urgent, buy, stop, createdAt, review, reviewedAt,
    authorId: own ? userId : '',
    author: '匿名申请人',
    comments: comments.map((comment) => ({
      id: comment.id,
      text: comment.text,
      createdAt: comment.createdAt,
      author: comment.authorId === authorId ? '匿名申请人' : '匿名裁判',
    })),
    myVote: votes[userId] ?? null,
  }
}

function projectGroup(entry, userId, now) {
  const { _id, title, description, target, private: isPrivate, theme, icon, authorId, memberIds, checkIns, createdAt } = entry
  const today = localDay(now)
  const days = checkIns[userId] ?? []
  const checkedMembersToday = memberIds.filter((memberId) => checkIns[memberId]?.includes(today)).length
  return {
    id: _id, title, description, target, private: isPrivate, theme, icon, createdAt,
    authorId: authorId === userId ? userId : '',
    members: memberIds.length,
    joined: memberIds.includes(userId),
    checkedToday: days.includes(today),
    checkedMembersToday,
    days: days.length,
    checkIns: days,
  }
}

function projectLedger({ _id, title, amountCents, createdAt, caseId }) {
  return { id: _id, title, amount: amountCents / 100, createdAt, ...(caseId ? { caseId } : {}) }
}

function mergeRecords(...lists) {
  return [...new Map(lists.flat().map((entry) => [entry._id, entry])).values()]
    .sort((left, right) => right.createdAt - left.createdAt)
}

// caseId and groupId name a record opened by link; it is included even when it falls outside the latest lists.
async function snapshot(db, userId, now, { caseId, groupId } = {}) {
  const cases = db.collection(collections.cases)
  const groups = db.collection(collections.groups)
  const [latest, own, publicGroups, joined, ledger, focusCase, focusGroup] = await Promise.all([
    cases.where({ hidden: false }).orderBy('createdAt', 'desc').limit(50).get(),
    cases.where({ authorId: userId, hidden: false }).orderBy('createdAt', 'desc').limit(50).get(),
    groups.where({ private: false }).orderBy('createdAt', 'desc').limit(50).get(),
    groups.where({ memberIds: db.command.in([userId]) }).orderBy('createdAt', 'desc').limit(50).get(),
    db.collection(collections.ledger).where({ authorId: userId }).orderBy('createdAt', 'desc').limit(100).get(),
    validRecordId(caseId) ? document(db, collections.cases, caseId) : null,
    validRecordId(groupId) ? document(db, collections.groups, groupId) : null,
  ])
  return {
    userId,
    cases: mergeRecords(latest.data, own.data, focusCase && !focusCase.hidden ? [focusCase] : [])
      .map((entry) => projectCase(entry, userId)),
    groups: mergeRecords(publicGroups.data, joined.data, focusGroup && (!focusGroup.private || focusGroup.memberIds.includes(userId)) ? [focusGroup] : [])
      .map((entry) => projectGroup(entry, userId, now)),
    ledger: ledger.data.map(projectLedger),
  }
}

async function caseRecord(db, id) {
  const entry = await document(db, collections.cases, checkedId(id))
  if (!entry || entry.hidden) throw new CourtError('NOT_FOUND', '这份申请不存在或已下架')
  return entry
}

function requireOpen(entry) {
  if (entry.review) throw new CourtError('CLOSED', '这份申请已复盘')
}

async function groupRecord(db, id, userId) {
  const entry = await document(db, collections.groups, checkedId(id))
  if (!entry || (entry.private && !entry.memberIds.includes(userId))) {
    throw new CourtError('NOT_FOUND', '找不到可加入的这个小组')
  }
  return entry
}

module.exports = {
  document, existingCreate, insertOnce, transaction, authenticate,
  projectCase, projectGroup, projectLedger, snapshot, caseRecord, requireOpen, groupRecord,
}
