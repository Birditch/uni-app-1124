import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import cloudFunction from '../uniCloud-aliyun/cloudfunctions/buy-or-not/index.js'

const { main } = cloudFunction
const application = {
  title: '机械键盘',
  category: '数码科技',
  price: '223.19',
  budget: '0',
  reason: '喜欢按键声音',
}

const command = {
  in: (values) => ({ operator: 'in', values }),
  push: (values) => ({ operator: 'push', values }),
}

function applyChanges(record, changes) {
  for (const [path, value] of Object.entries(changes)) {
    const keys = path.split('.')
    const key = keys.pop()
    const parent = keys.reduce((object, segment) => object[segment], record)
    parent[key] = value?.operator === 'push'
      ? [...parent[key], ...structuredClone(value.values)]
      : structuredClone(value)
  }
}

function matches(record, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    if (expected?.operator === 'in') return [record[key]].flat().some((value) => expected.values.includes(value))
    return record[key] === expected
  })
}

// A store is one view of the tables: the committed data or a transaction's private copy.
function documentRef(store, table, id) {
  return {
    async get() {
      const record = structuredClone(table.get(id))
      return { data: store.transactional ? record ?? null : record ? [record] : [] }
    },
    async update(changes) {
      const record = table.get(id)
      assert.ok(record)
      applyChanges(record, changes)
      store.onWrite()
      return { updated: 1 }
    },
    async remove() {
      const deleted = table.delete(id) ? 1 : 0
      store.onWrite()
      return { deleted }
    },
  }
}

function collection(store, name, query = {}) {
  const { filter = {}, sort, direction, limit } = query
  const next = (change) => collection(store, name, { ...query, ...change })
  const table = store.records.get(name) ?? new Map()
  store.records.set(name, table)

  return {
    doc: (id) => documentRef(store, table, id),
    async add(record) {
      assert.equal(typeof record._id, 'string')
      if (table.has(record._id)) throw new Error('duplicate key')
      table.set(record._id, structuredClone(record))
      store.onWrite()
      return { id: record._id }
    },
    where: (fields) => next({ filter: fields }),
    orderBy: (field, order) => next({ sort: field, direction: order }),
    limit: (size) => next({ limit: size }),
    async get() {
      store.beforeQuery(name)
      const result = [...table.values()].filter((record) => matches(record, filter))
      if (sort) result.sort((left, right) => (direction === 'desc' ? -1 : 1) * (left[sort] - right[sort]))
      return { data: structuredClone(result.slice(0, limit)) }
    },
  }
}

// Transactions write to a copy and fail with code 112 when another write committed first.
function startTransaction(world, beforeQuery) {
  const start = world.version
  const store = {
    records: structuredClone(world.data),
    transactional: true,
    changed: false,
    beforeQuery,
    onWrite() { store.changed = true },
  }
  return {
    collection: (name) => collection(store, name),
    async commit() {
      if (!store.changed) return
      if (world.version !== start) {
        world.conflicts += 1
        const error = new Error('injected write conflict')
        error.code = 112
        throw error
      }
      world.data = store.records
      world.version += 1
    },
    async rollback() {},
  }
}

function fakeDatabase() {
  const world = { data: new Map(), version: 0, conflicts: 0, failingSnapshot: false }
  const beforeQuery = (name) => {
    if (name !== 'bon-ledger' || !world.failingSnapshot) return
    world.failingSnapshot = false
    throw new Error('injected ledger snapshot failure')
  }
  const committed = () => ({
    records: world.data,
    transactional: false,
    beforeQuery,
    onWrite() { world.version += 1 },
  })

  return {
    command,
    get conflicts() { return world.conflicts },
    records: (name) => [...(world.data.get(name)?.values() ?? [])],
    failNextLedgerSnapshot() { world.failingSnapshot = true },
    collection: (name) => collection(committed(), name),
    startTransaction: async () => startTransaction(world, beforeQuery),
  }
}

function fixture(t) {
  const db = fakeDatabase()
  const uploads = []
  const previous = globalThis.uniCloud
  globalThis.uniCloud = {
    database: () => db,
    async uploadFile(options) {
      uploads.push(options)
      return { fileID: 'https://example.test/image.png' }
    },
  }
  t.after(() => {
    if (previous === undefined) delete globalThis.uniCloud
    else globalThis.uniCloud = previous
  })
  return { db, uploads }
}

async function call(action, token, payload, code) {
  const result = await main({ action, token, payload })
  assert.equal(result.ok, !code, result.message)
  if (code) assert.equal(result.code, code)
  return result
}

test('cloud sessions protect anonymous identities and validate public input', async (t) => {
  const { db, uploads } = fixture(t)
  const alice = await call('bootstrap')
  const bob = await call('bootstrap')
  assert.notEqual(alice.userId, bob.userId)
  assert.match(alice.token, /^[a-f\d]{64}$/)
  const storedSession = db.records('bon-sessions').find((entry) => entry.userId === alice.userId)
  assert.equal(storedSession._id, createHash('sha256').update(alice.token).digest('hex'))
  assert.equal('token' in storedSession, false)
  assert.equal((await call('bootstrap', alice.token)).token, undefined)
  await call('bootstrap', 'a'.repeat(64), {}, 'SESSION_INVALID')
  await call('vote', undefined, {}, 'SESSION_INVALID')

  await call('createCase', alice.token, { ...application, price: '1.001' }, 'VALIDATION')
  await call('createCase', alice.token, { ...application, title: '出 售 个 人 信 息' }, 'MODERATION')
  await call('createCase', alice.token, { ...application, image: 'data:image/png;base64,YWFh' }, 'VALIDATION')
  const file = Buffer.from('89504e470d0a1a0a', 'hex')
  const image = `data:image/png;base64,${file.toString('base64')}`
  const posted = (await call('createCase', alice.token, { ...application, image })).result
  assert.equal(uploads.length, 1)
  assert.deepEqual(uploads[0].fileContent, file)
  assert.equal(posted.image, 'https://example.test/image.png')
  assert.equal(posted.authorId, alice.userId)
  assert.equal(posted.budget, 0)
  assert.equal(posted.price, 223.19)

  const publicView = (await call('bootstrap', bob.token)).cases[0]
  assert.equal(publicView.authorId, '')
  assert.equal(publicView.myVote, null)
  assert.equal('votes' in publicView, false)
})

test('concurrent cloud votes reconcile with review and private ledger', async (t) => {
  const { db } = fixture(t)
  const owner = (await call('bootstrap')).token
  const bob = (await call('bootstrap')).token
  const cara = (await call('bootstrap')).token
  const { id } = (await call('createCase', owner, application)).result

  await call('vote', owner, { id, side: 'buy' }, 'FORBIDDEN')
  await Promise.all([
    call('vote', bob, { id, side: 'buy' }),
    call('vote', cara, { id, side: 'stop' }),
  ])
  assert.ok(db.conflicts > 0)
  await call('vote', bob, { id, side: 'stop' })
  const repeated = (await call('vote', bob, { id, side: 'stop' })).cases[0]
  assert.deepEqual([repeated.buy, repeated.stop, repeated.myVote], [0, 2, 'stop'])

  await call('comment', bob, { id, text: '先等打折' })
  const comment = (await call('comment', bob, { id, text: '先等打折' })).cases[0].comments
  assert.equal(comment.length, 1)
  assert.equal('authorId' in comment[0], false)
  await call('enableUrgent', bob, { id }, 'FORBIDDEN')
  assert.equal((await call('enableUrgent', owner, { id })).cases[0].urgent, true)

  await call('review', bob, { id, outcome: 'bought' }, 'FORBIDDEN')
  const bought = await call('review', owner, { id, outcome: 'bought' })
  assert.equal(bought.cases[0].review, 'bought')
  assert.deepEqual([bought.ledger[0].caseId, bought.ledger[0].amount], [id, 223.19])
  assert.deepEqual((await call('bootstrap', bob)).ledger, [])
  await call('vote', bob, { id, side: 'buy' }, 'CLOSED')
  const skipped = await call('review', owner, { id, outcome: 'skipped' })
  assert.equal(skipped.cases[0].review, 'skipped')
  assert.deepEqual(skipped.ledger, [])

  await Promise.all([
    call('report', bob, { id, reason: '可能是广告' }),
    call('report', bob, { id, reason: '可能是营销' }),
  ])
  assert.equal(db.records('bon-reports').length, 1)
  const reported = await call('report', cara, { id, reason: '品牌引流' })
  assert.equal(db.records('bon-reports').length, 2)
  assert.ok(db.records('bon-reports').every((report) => report.status === 'pending'))
  assert.equal('reports' in reported, false)
})

test('cloud groups share daily totals while protecting membership and individual check-ins', async (t) => {
  fixture(t)
  const originalNow = Date.now
  let now = Date.parse('2026-11-23T15:59:00Z')
  Date.now = () => now
  t.after(() => { Date.now = originalNow })

  const owner = (await call('bootstrap')).token
  const peer = (await call('bootstrap')).token
  const visitor = (await call('bootstrap')).token
  const privateGroup = (await call('createGroup', owner, { title: '存钱', target: 5, private: true })).result.id
  const publicGroup = (await call('createGroup', owner, { title: '少买鞋', target: 5 })).result.id

  const view = (await call('bootstrap', peer)).groups
  assert.deepEqual(view.map((group) => group.id), [publicGroup])
  assert.equal(view[0].checkedMembersToday, 0)
  await call('joinGroup', peer, { id: privateGroup }, 'NOT_FOUND')
  await call('checkIn', peer, { id: publicGroup }, 'FORBIDDEN')
  await Promise.all([
    call('joinGroup', peer, { id: publicGroup }),
    call('joinGroup', peer, { id: publicGroup }),
  ])
  await Promise.all([
    call('checkIn', peer, { id: publicGroup }),
    call('checkIn', peer, { id: publicGroup }),
  ])

  const peerView = (await call('bootstrap', peer)).groups.find((group) => group.id === publicGroup)
  assert.deepEqual([peerView.members, peerView.days, peerView.checkedToday, peerView.checkedMembersToday], [2, 1, true, 1])
  const ownerView = (await call('bootstrap', owner)).groups.find((group) => group.id === publicGroup)
  assert.deepEqual([ownerView.days, ownerView.checkedToday, ownerView.checkIns, ownerView.checkedMembersToday], [0, false, [], 1])
  assert.equal('memberIds' in peerView, false)
  const afterOwner = (await call('checkIn', owner, { id: publicGroup })).groups.find((group) => group.id === publicGroup)
  assert.equal(afterOwner.checkedMembersToday, 2)
  const visitorView = (await call('bootstrap', visitor)).groups
  assert.deepEqual(visitorView.map(({ id, checkedMembersToday }) => ({ id, checkedMembersToday })), [{ id: publicGroup, checkedMembersToday: 2 }])
  const ownPrivate = (await call('checkIn', owner, { id: privateGroup })).groups.find((group) => group.id === privateGroup)
  assert.deepEqual([ownPrivate.members, ownPrivate.days, ownPrivate.checkedToday, ownPrivate.checkedMembersToday], [1, 1, true, 1])
  assert.ok(!(await call('bootstrap', peer)).groups.some((group) => group.id === privateGroup))

  now = Date.parse('2026-11-23T16:01:00Z')
  const reset = (await call('bootstrap', visitor)).groups.find((group) => group.id === publicGroup)
  assert.equal(reset.checkedMembersToday, 0)
  const nextDay = (await call('checkIn', peer, { id: publicGroup })).groups.find((group) => group.id === publicGroup)
  assert.deepEqual(nextDay.checkIns, ['2026-11-23', '2026-11-24'])
  assert.equal(nextDay.checkedMembersToday, 1)
})

test('cloud creates keep one durable record through lost refresh and repeated request IDs', async (t) => {
  const { db } = fixture(t)
  const logError = t.mock.method(console, 'error', () => {})
  const token = (await call('bootstrap')).token
  const ledger = { action: 'addLedger', token, payload: { title: '晚餐', amount: 18 }, requestId: 'retry-after-refresh-failure' }

  db.failNextLedgerSnapshot()
  const written = await main(ledger)
  assert.deepEqual([written.ok, written.refreshRequired, written.result.title], [true, true, '晚餐'])
  assert.equal(logError.mock.callCount(), 1)
  assert.equal(written.ledger, undefined)
  assert.deepEqual((await call('bootstrap', token)).ledger, [written.result])
  assert.deepEqual((await main(ledger)).result, written.result)

  const requests = [
    { action: 'createCase', collection: 'bon-cases', payload: application },
    { action: 'createGroup', collection: 'bon-groups', payload: { title: '少买鞋', target: 7 } },
    { action: 'addLedger', collection: 'bon-ledger', payload: { title: '早餐', amount: 8 } },
  ]
  for (const { action, collection, payload } of requests) {
    const request = { action, token, payload, requestId: 'same-concurrent-submission' }
    const [first, second] = await Promise.all([main(request), main(request)])
    assert.equal(first.ok, true, first.message)
    assert.equal(second.ok, true, second.message)
    assert.equal(first.result.id, second.result.id)
    assert.equal(db.records(collection).filter((record) => record.title === payload.title).length, 1)
  }
})
