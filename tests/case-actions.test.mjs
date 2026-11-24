import assert from 'node:assert/strict'
import test from 'node:test'
import { nextTick, ref } from 'vue'
import { useCaseActions } from '../src/lib/case-actions.js'

// A fake store whose mutations stay pending until the test settles them in call order.
function setup() {
  const calls = []
  const steps = []
  const mutation = (name) => (...args) => {
    calls.push([name, ...args])
    return new Promise((resolve, reject) => steps.push({ resolve, reject }))
  }
  const court = {
    userId: 'reader',
    reports: [{ id: 'report-b', caseId: 'case-b', userId: 'reader' }],
    vote: mutation('vote'),
    comment: mutation('comment'),
    report: mutation('report'),
  }
  const caseId = ref('case-a')
  const itemRef = ref({ id: 'case-a', myVote: null, review: null })
  const notices = []
  const actions = useCaseActions({ court, getCaseId: () => caseId.value, itemRef, onNotice: (message) => notices.push(message) })
  return { actions, calls, steps, caseId, notices }
}

test('case actions drop a result that arrives after the reader opens another case', async () => {
  const { actions, steps, caseId, notices } = setup()
  const voting = actions.castVote('buy')
  assert.equal(actions.pending.value, 'vote')
  caseId.value = 'case-b'
  await nextTick()
  steps[0].resolve()
  await voting
  assert.equal(actions.pending.value, '')
  assert.equal(actions.liveStatus.value, '')
  assert.deepEqual(notices, [])

  const reporting = (actions.reportReason.value = '广告', actions.sendReport())
  caseId.value = 'case-c'
  await nextTick()
  steps[1].reject(new Error('举报失败'))
  await reporting
  assert.deepEqual(notices, [])
})

test('case actions run one mutation at a time and announce failures and successes', async () => {
  const { actions, calls, steps, notices } = setup()
  actions.advice.value = '   '
  await actions.postAdvice()
  assert.equal(calls.length, 0)

  actions.advice.value = '  先借来用一周  '
  const posting = actions.postAdvice()
  const ignored = actions.castVote('buy')
  assert.deepEqual(calls, [['comment', 'case-a', '先借来用一周']])
  await ignored
  steps[0].reject(new Error('这份申请的评论区已满'))
  await posting
  assert.equal(actions.liveStatus.value, '这份申请的评论区已满')
  assert.equal(actions.advice.value, '  先借来用一周  ')

  const offline = actions.castVote('stop')
  steps[1].reject('offline')
  await offline
  const voting = actions.castVote('stop')
  steps[2].resolve()
  await voting
  assert.deepEqual(notices, ['这份申请的评论区已满', '操作失败，请再试一次', '裁决已提交'])
})

test('report form closes on success and every draft resets when the case changes', async () => {
  const { actions, steps, caseId, notices } = setup()
  assert.equal(actions.reportedForCase.value, false)
  actions.reportOpen.value = true
  actions.reportReason.value = ' 疑似广告 '
  const reporting = actions.sendReport()
  steps[0].resolve()
  await reporting
  assert.deepEqual([actions.reportOpen.value, actions.reportReason.value, actions.reportedForCase.value], [false, '', true])
  assert.deepEqual(notices, ['已记录举报'])

  actions.advice.value = '再想想'
  actions.reportOpen.value = true
  caseId.value = 'case-b'
  await nextTick()
  assert.deepEqual([actions.advice.value, actions.reportOpen.value, actions.liveStatus.value], ['', false, ''])
  assert.equal(actions.reportedForCase.value, true, 'a report stored for case-b still counts')
  caseId.value = 'case-c'
  await nextTick()
  assert.equal(actions.reportedForCase.value, false)
})
