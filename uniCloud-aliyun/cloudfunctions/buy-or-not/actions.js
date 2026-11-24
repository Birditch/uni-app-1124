'use strict'

const { collections, CourtError, hash, newId, localDay } = require('./shared.js')
const { categories, themes, iconNames, text, publicText, amount, imageBuffer } = require('./validation.js')
const {
  document, existingCreate, insertOnce, transaction,
  projectCase, projectGroup, projectLedger, caseRecord, requireOpen, groupRecord,
} = require('./records.js')

async function addCase({ db, cloud, userId, p, now, requestRecordId }) {
  const existing = await existingCreate(db, collections.cases, requestRecordId)
  if (existing) return projectCase(existing, userId)
  const category = p.category
  if (!categories.includes(category)) throw new CourtError('VALIDATION', '请选择消费分类')
  const entry = {
    _id: requestRecordId ?? newId(),
    title: publicText(p.title, '物品名称', 60), category,
    priceCents: amount(p.price, '商品价格'),
    budgetCents: p.budget == null || p.budget === '' ? null : amount(p.budget, '个人预算', true),
    reason: publicText(p.reason, '心动理由', 400),
    concern: publicText(p.concern, '顾虑', 200, false),
    alternative: publicText(p.alternative, '替代方案', 200, false),
    createdAt: now, authorId: userId, image: '', hidden: false,
    urgent: p.urgent === true, review: null, reviewedAt: null, buy: 0, stop: 0, votes: {}, comments: [],
  }
  const file = imageBuffer(p.image)
  if (file) {
    const upload = await cloud.uploadFile({
      cloudPath: `buy-or-not/${entry._id}.${file.extension}`,
      cloudPathAsRealPath: true,
      fileContent: file.bytes,
    })
    entry.image = upload.fileID
  }
  return projectCase(await insertOnce(db, collections.cases, entry, requestRecordId), userId)
}

async function vote({ db, userId, p }) {
  if (!['buy', 'stop'].includes(p.side)) throw new CourtError('VALIDATION', '请选择要投的一方')
  await transaction(db, async (tx) => {
    const entry = await caseRecord(tx, p.id)
    requireOpen(entry)
    if (entry.authorId === userId) throw new CourtError('FORBIDDEN', '请让其他裁判为你的申请投票')
    const previous = entry.votes[userId]
    if (previous === p.side) return
    const counts = { buy: entry.buy, stop: entry.stop }
    if (previous) counts[previous] -= 1
    counts[p.side] += 1
    await tx.collection(collections.cases).doc(entry._id).update({
      ...counts,
      [`votes.${userId}`]: p.side,
    })
  })
}

async function comment({ db, userId, p, now }) {
  const message = publicText(p.text, '评论', 200)
  await transaction(db, async (tx) => {
    const entry = await caseRecord(tx, p.id)
    requireOpen(entry)
    if (entry.comments.length >= 50) throw new CourtError('LIMIT', '这份申请的评论区已满')
    const last = entry.comments.at(-1)
    if (last?.authorId === userId && last.text === message && now - last.createdAt < 10_000) return
    await tx.collection(collections.cases).doc(entry._id).update({
      comments: db.command.push([{ id: newId(), authorId: userId, text: message, createdAt: now }]),
    })
  })
}

async function review({ db, userId, p, now }) {
  if (!['bought', 'skipped'].includes(p.outcome)) throw new CourtError('VALIDATION', '请选择复盘结果')
  await transaction(db, async (tx) => {
    const entry = await caseRecord(tx, p.id)
    if (entry.authorId !== userId) throw new CourtError('FORBIDDEN', '只有申请人可以记录复盘结果')
    if (entry.review === p.outcome) return

    const ledgerId = `case-${entry._id}`
    const old = await document(tx, collections.ledger, ledgerId)
    if (p.outcome === 'bought' && !old) {
      await tx.collection(collections.ledger).add({
        _id: ledgerId, caseId: entry._id, title: entry.title, amountCents: entry.priceCents, createdAt: now, authorId: userId,
      })
    }
    if (p.outcome === 'skipped' && old) await tx.collection(collections.ledger).doc(ledgerId).remove()
    await tx.collection(collections.cases).doc(entry._id).update({ review: p.outcome, reviewedAt: now })
  })
}

async function enableUrgent({ db, userId, p }) {
  await transaction(db, async (tx) => {
    const entry = await caseRecord(tx, p.id)
    if (entry.authorId !== userId) throw new CourtError('FORBIDDEN', '只有申请人可以设置加急')
    requireOpen(entry)
    if (!entry.urgent) await tx.collection(collections.cases).doc(entry._id).update({ urgent: true })
  })
}

async function addGroup({ db, userId, p, now, requestRecordId }) {
  const existing = await existingCreate(db, collections.groups, requestRecordId)
  if (existing) return projectGroup(existing, userId, now)
  const target = Number(p.target)
  if (!['number', 'string'].includes(typeof p.target) || !Number.isInteger(target) || target < 1 || target > 365) {
    throw new CourtError('VALIDATION', '打卡目标须为 1 至 365 天')
  }
  const entry = {
    _id: requestRecordId ?? newId(),
    title: publicText(p.title, '小组名称', 40),
    description: publicText(p.description, '小组介绍', 200, false),
    target, private: p.private === true, createdAt: now, authorId: userId,
    icon: iconNames.includes(p.icon) ? p.icon : 'target',
    theme: themes.includes(p.theme) ? p.theme : 'green',
    memberIds: [userId], checkIns: {},
  }
  return projectGroup(await insertOnce(db, collections.groups, entry, requestRecordId), userId, now)
}

async function joinGroup({ db, userId, p }) {
  await transaction(db, async (tx) => {
    const entry = await groupRecord(tx, p.id, userId)
    if (entry.memberIds.includes(userId)) return
    if (entry.memberIds.length >= 200) throw new CourtError('LIMIT', '这个小组已经满员')
    await tx.collection(collections.groups).doc(entry._id).update({
      memberIds: db.command.push([userId]),
    })
  })
}

async function checkIn({ db, userId, p, now }) {
  await transaction(db, async (tx) => {
    const entry = await groupRecord(tx, p.id, userId)
    if (!entry.memberIds.includes(userId)) throw new CourtError('FORBIDDEN', '加入小组后即可打卡')
    const history = entry.checkIns[userId] ?? []
    const day = localDay(now)
    if (history.includes(day)) return
    if (history.length >= entry.target) throw new CourtError('COMPLETE', '你的打卡目标已经达成')
    await tx.collection(collections.groups).doc(entry._id).update({ [`checkIns.${userId}`]: [...history, day] })
  })
}

async function addLedger({ db, userId, p, now, requestRecordId }) {
  const existing = await existingCreate(db, collections.ledger, requestRecordId)
  if (existing) return projectLedger(existing)
  const entry = {
    _id: requestRecordId ?? newId(), authorId: userId, createdAt: now,
    title: text(p.title, '账目名称', 60),
    amountCents: amount(p.amount, '支出金额'),
  }
  return projectLedger(await insertOnce(db, collections.ledger, entry, requestRecordId))
}

async function report({ db, userId, p, now }) {
  const reason = text(p.reason, '举报原因', 120)
  const entry = await caseRecord(db, p.id)
  const id = hash(`${userId}:${entry._id}`)
  const reports = db.collection(collections.reports)
  if (await document(db, collections.reports, id)) return
  try {
    await reports.add({ _id: id, caseId: entry._id, reporterId: userId, reason, status: 'pending', createdAt: now })
  } catch (error) {
    if (!(await document(db, collections.reports, id))) throw error
  }
}

const actions = new Map(Object.entries({
  createCase: addCase, vote, comment, review, enableUrgent,
  createGroup: addGroup, joinGroup, checkIn, addLedger, report,
}))

module.exports = { actions }
