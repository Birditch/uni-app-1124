import assert from 'node:assert/strict'
import test from 'node:test'
import { useRemoteCourt } from '../src/lib/remote.js'

const token = 'demo-token'
const firstUser = 'first-user'
const entry = { id: 'ledger-1', title: '地铁', amount: 3 }

// Fake uni storage and cloud function: the first create disconnects, the second hits a server error,
// the third succeeds but asks for a refresh. Setting expire makes the next call report an expired session.
function stubCloud(t) {
  const stub = { requests: [], storage: new Map(), nextUser: firstUser, creates: 0, expire: false }
  const snapshot = () => ({
    ok: true, userId: stub.nextUser, cases: [], groups: [],
    ledger: stub.creates === 3 && stub.nextUser === firstUser ? [entry] : [],
  })
  globalThis.uni = {
    getStorageSync: (key) => stub.storage.get(key),
    setStorageSync: (key, value) => stub.storage.set(key, value),
    removeStorageSync: (key) => stub.storage.delete(key),
  }
  globalThis.uniCloud = {
    async callFunction({ name, data }) {
      assert.equal(name, 'buy-or-not')
      stub.requests.push(data)
      if (stub.expire) {
        stub.expire = false
        return { result: { ok: false, code: 'SESSION_INVALID', message: '匿名身份已失效' } }
      }
      if (data.action === 'bootstrap') return { result: { ...snapshot(), ...(data.token ? {} : { token }) } }
      if (++stub.creates === 1) throw new Error('network disconnected')
      if (stub.creates === 2) return { result: { ok: false, code: 'SERVER_ERROR', message: '服务暂时繁忙' } }
      return { result: { ok: true, userId: firstUser, result: entry, refreshRequired: true } }
    },
  }
  t.after(() => {
    delete globalThis.uni
    delete globalThis.uniCloud
  })
  return stub
}

test('cloud client reuses a create ID after disconnect and clears an expired identity', async (t) => {
  const stub = stubCloud(t)
  const { requests, storage } = stub
  const court = useRemoteCourt()
  await court.refresh()
  assert.equal(court.userId, firstUser)
  assert.equal([...storage.values()][0], token)

  const draft = { title: entry.title, amount: entry.amount }
  await assert.rejects(court.addLedger(draft), /无法连接/)
  await assert.rejects(court.addLedger(draft), /服务暂时繁忙/)
  assert.deepEqual(await court.addLedger(draft), entry)
  await court.refresh()
  assert.deepEqual(court.ledger, [entry])
  const ids = requests.filter(({ action }) => action === 'addLedger').map(({ requestId }) => requestId)
  assert.equal(ids.length, 3)
  assert.match(ids[0], /^[A-Za-z0-9_-]{12,100}$/)
  assert.equal(new Set(ids).size, 1)
  assert.deepEqual(requests[4], { action: 'bootstrap', token, payload: {}, requestId: undefined })

  stub.expire = true
  await court.refresh()
  assert.equal(court.error, '匿名身份已失效')
  assert.equal(court.userId, '')
  assert.deepEqual(court.ledger, [])
  assert.equal(storage.size, 0)
  stub.nextUser = 'new-user'
  await court.refresh()
  assert.equal(court.userId, stub.nextUser)
  assert.equal(requests.at(-1).token, undefined)
})
