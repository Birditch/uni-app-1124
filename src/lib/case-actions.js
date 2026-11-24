import { computed, ref, watch } from 'vue'

// One mutation runs at a time, and a result that arrives after the reader opened another case is dropped.
function useGuardedRun(getCaseId, onNotice) {
  const pending = ref('')
  const liveStatus = ref('')
  watch(getCaseId, () => {
    liveStatus.value = ''
  })

  function notify(message) {
    liveStatus.value = message
    onNotice(message)
  }

  async function run(action, mutation, onSuccess) {
    if (pending.value) return
    const id = getCaseId()
    pending.value = action
    try {
      await mutation(id)
      if (id === getCaseId()) onSuccess()
    } catch (error) {
      if (id === getCaseId()) notify(error instanceof Error ? error.message : '操作失败，请再试一次')
    } finally {
      pending.value = ''
    }
  }

  return { pending, liveStatus, notify, run }
}

// Draft advice and report forms reset whenever the page switches to another case.
function useCaseForms(getCaseId, court) {
  const advice = ref('')
  const reportReason = ref('')
  const reportOpen = ref(false)
  const reported = ref(false)
  const reportedForCase = computed(() => reported.value || court.reports?.some((entry) => (
    entry.caseId === getCaseId() && entry.userId === court.userId
  )))
  watch(getCaseId, () => {
    advice.value = ''
    reportOpen.value = false
    reportReason.value = ''
    reported.value = false
  })
  return { advice, reportReason, reportOpen, reported, reportedForCase }
}

// court is the demo or cloud store; getCaseId returns the open case id; itemRef holds that case.
export function useCaseActions({ court, getCaseId, itemRef, onNotice }) {
  const { advice, reportReason, reportOpen, reported, reportedForCase } = useCaseForms(getCaseId, court)
  const { pending, liveStatus, notify, run } = useGuardedRun(getCaseId, onNotice)

  async function castVote(choice) {
    if (itemRef.value?.myVote === choice) return
    const hadVote = Boolean(itemRef.value?.myVote)
    await run('vote', (id) => court.vote(id, choice), () => notify(hadVote ? '裁决已更新' : '裁决已提交'))
  }

  async function postAdvice() {
    const message = advice.value.trim()
    if (!message) return
    await run('comment', (id) => court.comment(id, message), () => {
      advice.value = ''
      notify('匿名劝言已发布')
    })
  }

  async function saveReview(outcome) {
    if (itemRef.value?.review === outcome) return
    await run('review', (id) => court.review(id, outcome), () => {
      notify(outcome === 'bought' ? '复盘已保存，金额已计入账本' : '复盘已保存')
    })
  }

  async function enableUrgency() {
    await run('urgent', (id) => court.enableUrgent(id), () => notify('已进入演示加急队列'))
  }

  async function sendReport() {
    const reason = reportReason.value.trim()
    if (!reason) return
    await run('report', (id) => court.report(id, reason), () => {
      reportOpen.value = false
      reportReason.value = ''
      reported.value = true
      notify('已记录举报')
    })
  }

  return {
    advice, reportReason, reportOpen, reportedForCase, pending, liveStatus,
    castVote, postAdvice, saveReview, enableUrgency, sendReport,
  }
}
