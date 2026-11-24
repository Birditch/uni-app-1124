import assert from 'node:assert/strict'
import { test } from 'node:test'
import { relativeTime } from '../src/lib/format.js'
import { createCourt, money } from '../src/lib/store.js'

function fixture() {
  let saved
  let failWrites = false
  let clock = new Date(2026, 10, 23, 8).getTime()
  let nextId = 0
  const options = {
    storage: {
      getItem: () => saved,
      setItem: (_key, value) => {
        if (failWrites) throw new Error('quota')
        saved = value
      },
    },
    now: () => clock,
    makeId: (prefix) => `${prefix}-${++nextId}`,
  }
  return {
    store: createCourt(options),
    reopen: () => createCourt(options),
    nextDay: () => { clock = new Date(2026, 10, 24, 8).getTime() },
    failWrites: () => { failWrites = true },
  }
}

const cameraForm = { title: ' 二手相机 ', category: '兴趣爱好', price: '199.50', reason: '毕业旅行记录' }

test('replaces a published vote and persists the one-choice tally', () => {
  const { store, reopen } = fixture()
  const original = store.cases.find((item) => item.id === 'case-keyboard')
  assert.equal(store.vote(original.id, 'buy').buy, original.buy + 1)
  assert.equal(store.vote(original.id, 'buy').buy, original.buy + 1)
  const switched = store.vote(original.id, 'stop')
  assert.equal(switched.buy, original.buy)
  assert.equal(switched.stop, original.stop + 1)
  assert.equal(reopen().cases.find((item) => item.id === original.id).myVote, 'stop')
})

test('persists an anonymous application, closes it on review and reconciles its ledger row', () => {
  const { store, reopen } = fixture()
  const item = store.createCase(cameraForm)
  assert.equal(item.title, '二手相机')
  assert.equal(item.price, 199.5)
  assert.equal(item.budget, null)
  assert.equal(item.authorId, store.userId)
  assert.throws(() => store.vote(item.id, 'buy'), /旁观者/)
  assert.throws(() => store.review('case-keyboard', 'bought'), /发起人/)

  store.comment(item.id, '打算先去试机')
  store.enableUrgent(item.id)
  store.review(item.id, 'bought')
  store.review(item.id, 'bought')
  assert.equal(store.ledger.filter((entry) => entry.caseId === item.id).length, 1)
  assert.throws(() => store.comment(item.id, '已闭案'), /复盘/)
  assert.equal(reopen().cases.find((entry) => entry.id === item.id).review, 'bought')

  store.review(item.id, 'skipped')
  assert.equal(reopen().ledger.some((entry) => entry.caseId === item.id), false)
  const restored = reopen().cases.find((entry) => entry.id === item.id)
  assert.equal(restored.review, 'skipped')
  assert.equal(restored.urgent, true)
  assert.deepEqual(restored.comments.map((entry) => entry.text), ['打算先去试机'])
})

test('requires membership and counts at most one check-in per local day', () => {
  const { store, nextDay, reopen } = fixture()
  const group = store.groups.find((entry) => !entry.joined)
  assert.throws(() => store.checkIn(group.id), /先加入/)
  assert.equal(store.joinGroup(group.id).members, group.members + 1)
  assert.equal(store.joinGroup(group.id).members, group.members + 1)
  const checked = store.checkIn(group.id)
  assert.equal(checked.checkedMembersToday, 1)
  assert.equal(checked.days, 1)
  assert.equal(checked.checkedToday, true)
  assert.equal(store.checkIn(group.id).days, 1)
  assert.equal(reopen().groups.find((entry) => entry.id === group.id).checkedToday, true)

  nextDay()
  store.refresh()
  assert.equal(store.groups.find((entry) => entry.id === group.id).checkedToday, false)
  assert.equal(store.groups.find((entry) => entry.id === group.id).checkedMembersToday, 0)
  assert.equal(store.checkIn(group.id).days, 2)
})

test('keeps other records consistent when validation or storage fails', () => {
  const { store, failWrites, reopen } = fixture()
  assert.throws(() => store.createCase({ ...cameraForm, price: '12.345' }), /两位小数/)
  assert.throws(() => store.createCase({ ...cameraForm, reason: '代办假证' }), /公开发布/)
  const report = store.report('case-keyboard', '内容疑似提供代办假证服务')
  assert.equal(store.report('case-keyboard', '重复举报').id, report.id)
  assert.equal(reopen().reports.length, 1)

  const item = store.createCase(cameraForm)
  failWrites()
  assert.throws(() => store.review(item.id, 'bought'), /保存失败/)
  assert.equal(store.cases.find((entry) => entry.id === item.id).review, null)
  assert.equal(store.ledger.some((entry) => entry.caseId === item.id), false)
  assert.equal(reopen().cases.find((entry) => entry.id === item.id).review, null)
})

test('formats whole and fractional amounts without losing a nonzero cent', () => {
  assert.equal(money(2999), '2,999')
  assert.equal(money(199.5), '199.5')
  assert.equal(money(12034.07), '12,034.07')
})

test('describes post and comment times relative to the reader clock', () => {
  const posted = new Date(2026, 10, 1, 12).getTime()
  const minute = 60_000
  assert.equal(relativeTime('not a date', posted), '')
  assert.equal(relativeTime(posted, posted - 5 * minute), '刚刚')
  assert.equal(relativeTime(posted, posted + 59_999), '刚刚')
  assert.equal(relativeTime(posted, posted + 59 * minute), '59 分钟前')
  assert.equal(relativeTime(posted, posted + 60 * minute), '1 小时前')
  assert.equal(relativeTime(posted, posted + 23 * 60 * minute + 59 * minute), '23 小时前')
  assert.equal(relativeTime(posted, posted + 24 * 60 * minute), '11 月 1 日')
})
