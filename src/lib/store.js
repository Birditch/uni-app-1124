import { computed, shallowRef } from 'vue'
import { localDateKey, money } from './format.js'
import { useRemoteCourt } from './remote.js'
import { createSeed } from './seed.js'

export { money } from './format.js'

const STORAGE_KEY = 'maibu-mai:v1'
export const CATEGORIES = Object.freeze(['数码科技', '穿搭美妆', '兴趣爱好', '日常生活', '其他'])
const GROUP_THEMES = ['green', 'lavender', 'peach']
const GROUP_ICONS = ['coffee', 'shopping-bag', 'target']
const BLOCKED_CONTENT = /色情招揽|裸聊|色情网|招嫖|走私枪支|出售毒品|代开假发票|代办假证|出售个人信息|博彩下注|killyourself/i
const MAX_AMOUNT = 1_000_000

function platformStorage() {
  if (typeof uni !== 'undefined') {
    return {
      getItem: (key) => uni.getStorageSync(key),
      setItem: (key, value) => uni.setStorageSync(key, value),
    }
  }
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

function restore(storage) {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    const saved = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (saved?.version === 1 && typeof saved.userId === 'string' && saved.userId
      && ['cases', 'groups', 'ledger', 'reports'].every((key) => Array.isArray(saved[key]))) {
      return saved
    }
  } catch {
    // A fresh sample state is available when storage cannot be read.
  }
  return undefined
}

function uniqueId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`
}

function textField(value, label, maxLength, required = false) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (required && !text) throw new Error(`请填写${label}`)
  if (Array.from(text).length > maxLength) throw new Error(`${label}最多 ${maxLength} 个字符`)
  return text
}

function publicText(value, label, maxLength, required) {
  const text = textField(value, label, maxLength, required)
  if (BLOCKED_CONTENT.test(text.normalize('NFKC').replace(/\s/g, ''))) throw new Error(`${label}包含不适合公开发布的内容`)
  return text
}

function amountField(value, label, optional = false) {
  const text = typeof value === 'number' || typeof value === 'string' ? String(value).trim() : ''
  if (!text && optional) return null
  if (!text) throw new Error(`请填写${label}`)
  const amount = Number(text)
  const decimal = /^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/
  if (!decimal.test(text) || (!optional && amount <= 0)) {
    throw new Error(`${label}请填写有效金额，最多两位小数`)
  }
  if (amount > MAX_AMOUNT) throw new Error(`${label}最高为 ${money(MAX_AMOUNT)} 元`)
  return amount
}

function replaceEntry(entries, entry) {
  return entries.map((existing) => existing.id === entry.id ? entry : existing)
}

function requireOpen(item) {
  if (item.review) throw new Error('本案已完成复盘')
}

function displayGroup(group, today) {
  const checkedToday = Boolean(group.joined && group.checkIns.includes(today))
  return {
    ...group,
    checkedToday,
    checkedMembersToday: Number(checkedToday),
  }
}

function requireCase({ state }, id) {
  const item = state.value.cases.find((entry) => entry.id === id)
  if (!item) throw new Error('找不到这份审批单')
  return item
}

function requireGroup({ state }, id) {
  const group = state.value.groups.find((entry) => entry.id === id)
  if (!group) throw new Error('找不到这个自律小组')
  return group
}

function requireAuthor({ userId }, item) {
  if (item.authorId !== userId) throw new Error('请由发起人操作')
}

function updateCase(ctx, item, changes = {}) {
  ctx.commit({ ...changes, cases: replaceEntry(ctx.state.value.cases, item) })
  return item
}

function updateGroup(ctx, group) {
  ctx.commit({ groups: replaceEntry(ctx.state.value.groups, group) })
  return displayGroup(group, ctx.today.value)
}

function createCase(ctx, { title, category, price, budget, reason, concern, alternative, image, urgent } = {}) {
  if (!CATEGORIES.includes(category)) throw new Error('请选择商品分类')
  const item = {
    id: ctx.makeId('case'),
    title: publicText(title, '物品名称', 60, true),
    category,
    price: amountField(price, '商品价格'),
    budget: amountField(budget, '消费预算', true),
    reason: publicText(reason, '心动理由', 400, true),
    concern: publicText(concern, '顾虑', 200),
    alternative: publicText(alternative, '替代方案', 200),
    image: typeof image === 'string' ? image.trim() : '',
    urgent: urgent === true,
    buy: 0,
    stop: 0,
    comments: [],
    createdAt: ctx.now(),
    authorId: ctx.userId,
    author: '匿名申请人',
    review: null,
    myVote: null,
  }
  ctx.commit({ cases: [item, ...ctx.state.value.cases] })
  return item
}

function vote(ctx, id, choice) {
  if (choice !== 'buy' && choice !== 'stop') throw new Error('请选择一个投票选项')
  const item = requireCase(ctx, id)
  requireOpen(item)
  if (item.authorId === ctx.userId) throw new Error('请把投票留给旁观者')
  if (item.myVote === choice) return item
  const updated = { ...item, [choice]: item[choice] + 1, myVote: choice }
  if (item.myVote) updated[item.myVote] = Math.max(0, item[item.myVote] - 1)
  return updateCase(ctx, updated)
}

function comment(ctx, id, text) {
  const item = requireCase(ctx, id)
  requireOpen(item)
  if (item.comments.length >= 50) throw new Error('这份申请的评论区已满')
  const entry = {
    id: ctx.makeId('comment'),
    author: item.authorId === ctx.userId ? '匿名申请人' : '匿名裁判',
    text: publicText(text, '评论内容', 200, true),
    createdAt: ctx.now(),
  }
  updateCase(ctx, { ...item, comments: [...item.comments, entry] })
  return entry
}

function review(ctx, id, decision) {
  if (decision !== 'bought' && decision !== 'skipped') throw new Error('请选择实际购买结果')
  const item = requireCase(ctx, id)
  requireAuthor(ctx, item)
  if (item.review === decision) return item

  const reviewedAt = ctx.now()
  const ledger = ctx.state.value.ledger.filter((entry) => entry.caseId !== id)
  if (decision === 'bought') {
    ledger.unshift({ id: ctx.makeId('ledger'), title: item.title, amount: item.price, caseId: id, createdAt: reviewedAt })
  }
  return updateCase(ctx, { ...item, review: decision, reviewedAt }, { ledger })
}

function enableUrgent(ctx, id) {
  const item = requireCase(ctx, id)
  requireAuthor(ctx, item)
  requireOpen(item)
  return item.urgent ? item : updateCase(ctx, { ...item, urgent: true })
}

function report(ctx, id, reason) {
  requireCase(ctx, id)
  const existing = ctx.state.value.reports.find((entry) => entry.caseId === id && entry.userId === ctx.userId)
  if (existing) return existing
  const entry = {
    id: ctx.makeId('report'),
    caseId: id,
    reason: textField(reason, '举报原因', 120, true),
    userId: ctx.userId,
    createdAt: ctx.now(),
  }
  ctx.commit({ reports: [entry, ...ctx.state.value.reports] })
  return entry
}

function createGroup(ctx, { title, description, target, private: isPrivate, theme, icon } = {}) {
  const days = Number(target)
  if ((typeof target !== 'number' && typeof target !== 'string') || !Number.isInteger(days) || days < 1 || days > 365) {
    throw new Error('目标天数须为 1 到 365 的整数')
  }
  const group = {
    id: ctx.makeId('group'),
    title: publicText(title, '小组名称', 40, true),
    description: publicText(description, '目标描述', 200),
    target: days,
    private: isPrivate === true,
    members: 1,
    joined: true,
    checkedToday: false,
    days: 0,
    theme: GROUP_THEMES.includes(theme) ? theme : 'green',
    icon: GROUP_ICONS.includes(icon) ? icon : 'target',
    checkIns: [],
    authorId: ctx.userId,
    createdAt: ctx.now(),
  }
  ctx.commit({ groups: [group, ...ctx.state.value.groups] })
  return displayGroup(group, ctx.today.value)
}

function joinGroup(ctx, id) {
  const group = requireGroup(ctx, id)
  if (group.joined) return displayGroup(group, ctx.today.value)
  if (group.private) throw new Error('该小组仅向成员开放')
  return updateGroup(ctx, { ...group, members: group.members + 1, joined: true })
}

function checkIn(ctx, id) {
  ctx.refresh()
  const today = ctx.today.value
  const group = requireGroup(ctx, id)
  if (!group.joined) throw new Error('请先加入小组')
  if (group.checkIns.includes(today)) return displayGroup(group, today)
  if (group.days >= group.target) throw new Error('你已完成这个目标')
  return updateGroup(ctx, { ...group, days: group.days + 1, checkIns: [...group.checkIns, today] })
}

function addLedger(ctx, { title, amount } = {}) {
  const entry = {
    id: ctx.makeId('ledger'),
    title: textField(title, '消费名称', 60, true),
    amount: amountField(amount, '消费金额'),
    createdAt: ctx.now(),
  }
  ctx.commit({ ledger: [entry, ...ctx.state.value.ledger] })
  return entry
}

function persist(storage, value) {
  storage?.setItem(STORAGE_KEY, JSON.stringify(value))
}

// Operations receive a context with the reactive state, clock, id factory and a commit that persists before publishing.
function createContext(storage, now, makeId) {
  const restored = restore(storage)
  const userId = restored?.userId ?? makeId('user')
  const state = shallowRef(restored ?? { version: 1, userId, ...createSeed(userId, now()) })
  const today = shallowRef(localDateKey(now()))
  if (!restored) {
    try {
      persist(storage, state.value)
    } catch {
      // Starting a demo requires only the sample state in memory.
    }
  }
  return {
    userId, now, makeId, state, today,
    commit(changes) {
      const next = { ...state.value, ...changes }
      try {
        persist(storage, next)
      } catch {
        throw new Error('保存失败，请检查设备存储空间后重试')
      }
      state.value = next
    },
    refresh() {
      today.value = localDateKey(now())
    },
  }
}

export function createCourt({ storage = platformStorage(), now = Date.now, makeId = uniqueId } = {}) {
  const ctx = createContext(storage, now, makeId)
  const { state, today } = ctx
  const groups = computed(() => {
    const day = today.value
    return state.value.groups.map((group) => displayGroup(group, day))
  })
  const bind = (operation) => (...args) => operation(ctx, ...args)

  return {
    mode: 'demo',
    get userId() { return ctx.userId },
    get cases() { return state.value.cases },
    get groups() { return groups.value },
    get ledger() { return state.value.ledger },
    get reports() { return state.value.reports },
    money,
    refresh: ctx.refresh,
    createCase: bind(createCase),
    vote: bind(vote),
    comment: bind(comment),
    review: bind(review),
    enableUrgent: bind(enableUrgent),
    report: bind(report),
    createGroup: bind(createGroup),
    joinGroup: bind(joinGroup),
    checkIn: bind(checkIn),
    addLedger: bind(addLedger),
  }
}

let court

export function useCourt() {
  if (import.meta.env?.VITE_COURT_MODE === 'cloud') return useRemoteCourt()
  court ??= createCourt()
  return court
}
