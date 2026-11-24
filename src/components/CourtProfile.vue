<template>
  <view class="profile">
    <view>
      <text class="page-title" role="heading" aria-level="1">消费档案</text>
      <text class="page-description">回看每一次心动，也记下每一笔花销。</text>
    </view>

    <view class="summary-grid">
      <view class="summary-card saved-card">
        <view class="summary-label">
          <view class="summary-icon"><AppIcon name="leaf" :size="19" /></view>
          <text>估算省下</text>
        </view>
        <text class="summary-value">¥{{ court.money(savedAmount) }}</text>
        <text class="summary-note">来自 {{ skippedCount }} 笔放弃购买的审批单</text>
      </view>

      <view class="summary-card spent-card">
        <view class="summary-label">
          <view class="summary-icon"><AppIcon name="wallet" :size="19" /></view>
          <text>账本支出</text>
        </view>
        <text class="summary-value">¥{{ court.money(spentAmount) }}</text>
        <text class="summary-note">审批入账与手动记录共 {{ court.ledger.length }} 笔</text>
      </view>

      <view class="summary-card ratio-card">
        <view class="summary-label">
          <view class="summary-icon"><AppIcon name="target" :size="19" /></view>
          <text>忍住比例</text>
        </view>
        <text class="summary-value">{{ reviewedCount ? skipRatio + '%' : '—' }}</text>
        <view v-if="reviewedCount" class="ratio-track" aria-hidden="true">
          <view class="ratio-fill" :style="{ width: skipRatio + '%' }" />
        </view>
        <text class="summary-note">{{ reviewedCount ? '已复盘 ' + reviewedCount + ' 笔 · 放弃购买 ' + skippedCount + ' 笔' : '完成一次复盘后显示比例' }}</text>
      </view>
    </view>

    <view class="archive-grid">
      <view class="archive-panel">
        <view class="panel-header">
          <view class="panel-icon"><AppIcon name="gavel" :size="19" /></view>
          <view class="panel-heading">
            <text class="panel-title" role="heading" aria-level="2">审批记录</text>
            <text class="panel-description">回到审批单记录最终决定。</text>
          </view>
        </view>

        <view class="record-filters" aria-label="审批记录筛选">
          <button
            v-for="filter in recordFilters"
            :key="filter.id"
            class="profile-button filter-button"
            :class="{ 'filter-active': recordFilter === filter.id }"
            :aria-pressed="recordFilter === filter.id"
            @click="recordFilter = filter.id"
          >
            {{ filter.title }}
          </button>
        </view>

        <view v-if="visibleCases.length" class="record-list">
          <button
            v-for="item in visibleCases"
            :key="item.id"
            class="profile-button record-row"
            :aria-label="'查看审批单：' + item.title"
            @click="emit('open', item.id)"
          >
            <image v-if="item.image" class="record-image" :src="item.image" mode="aspectFill" />
            <view v-else class="record-image record-placeholder">
              <AppIcon name="bag" :size="19" />
            </view>
            <view class="entry-main">
              <text class="entry-title">{{ item.title }}</text>
              <text class="entry-meta">{{ formatDate(item.createdAt) }} · {{ item.category }}</text>
            </view>
            <view class="record-result">
              <text class="entry-amount">¥{{ court.money(item.price) }}</text>
              <text class="result-badge" :class="resultFor(item).color">{{ resultFor(item).label }}</text>
            </view>
            <AppIcon name="chevron-right" :size="15" class="record-chevron" />
          </button>
        </view>
        <view v-else class="profile-empty">
          <AppIcon name="inbox" :size="26" />
          <text class="empty-title">{{ recordFilter === 'all' ? '还没有审批记录' : '这个筛选下暂无记录' }}</text>
          <button v-if="recordFilter === 'all'" class="profile-button text-button" @click="emit('compose')">提交我的第一单</button>
          <button v-else class="profile-button text-button" @click="recordFilter = 'all'">查看全部审批单</button>
        </view>
      </view>

      <view class="archive-panel ledger-panel">
        <view class="panel-header">
          <view class="panel-icon ledger-panel-icon"><AppIcon name="wallet" :size="19" /></view>
          <view class="panel-heading">
            <text class="panel-title" role="heading" aria-level="2">消费账本</text>
            <text class="panel-description">买了的审批单会自动入账。</text>
          </view>
          <button
            ref="ledgerToggle"
            class="profile-button secondary-button"
            :aria-expanded="ledgerOpen"
            :disabled="savingLedger"
            @click="ledgerOpen = !ledgerOpen"
          >
            <AppIcon :name="ledgerOpen ? 'x' : 'plus'" :size="16" />
            {{ ledgerOpen ? '收起' : '记一笔' }}
          </button>
        </view>

        <form v-if="ledgerOpen" class="ledger-form" @submit="saveLedger">
          <view class="ledger-field">
            <label for="ledger-title" class="field-label">消费名称</label>
            <input
              id="ledger-title"
              v-model="ledgerTitle"
              :focus="ledgerOpen"
              :maxlength="60"
              :disabled="savingLedger"
              class="field-input"
              placeholder="例如 午饭"
              aria-label="消费名称"
            />
          </view>
          <view class="ledger-field">
            <label for="ledger-amount" class="field-label">金额（元）</label>
            <input
              id="ledger-amount"
              v-model="ledgerAmount"
              type="digit"
              :maxlength="12"
              :disabled="savingLedger"
              confirm-type="done"
              :confirm-hold="true"
              class="field-input"
              placeholder="0.00"
              aria-label="金额（元）"
              @confirm="saveLedger"
            />
          </view>
          <text v-if="ledgerError" class="form-error" role="alert">{{ ledgerError }}</text>
          <button class="profile-button primary-button ledger-submit" form-type="submit" :disabled="savingLedger">
            {{ savingLedger ? '保存中…' : '保存记录' }}
          </button>
        </form>

        <view v-if="ledgerEntries.length" class="ledger-list">
          <view v-for="entry in ledgerEntries" :key="entry.id" class="ledger-row">
            <view class="ledger-entry-icon">
              <AppIcon :name="entry.caseId ? 'bag' : 'wallet'" :size="17" />
            </view>
            <view class="entry-main">
              <text class="entry-title">{{ entry.title }}</text>
              <text class="entry-meta">{{ formatDate(entry.createdAt) }} · {{ entry.caseId ? '审批入账' : '手动记账' }}</text>
            </view>
            <text class="entry-amount">¥{{ court.money(entry.amount) }}</text>
          </view>
        </view>
        <view v-else class="profile-empty">
          <AppIcon name="wallet" :size="25" />
          <text class="empty-title">账本还是空的</text>
          <text class="empty-note">复盘时选择「买了」，或手动记一笔。</text>
        </view>
      </view>
    </view>

    <view class="membership-panel">
      <button class="profile-button membership-toggle" :aria-expanded="membershipOpen" @click="membershipOpen = !membershipOpen">
        <view class="membership-icon"><AppIcon name="sparkles" :size="19" /></view>
        <view class="panel-heading">
          <text class="membership-title">会员权益预览</text>
          <text class="panel-description">完整复盘报告、无限加急和私密小组</text>
        </view>
        <AppIcon name="chevron-right" :size="17" class="membership-chevron" :class="{ expanded: membershipOpen }" />
      </button>
      <view v-if="membershipOpen" class="membership-content">
        <text>计划权益包含完整消费统计报告、无广告、无限加急和创建私密自律小组。</text>
        <text class="membership-note">演示期间暂未开放订阅。基础投票功能永久免费。</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import AppIcon from './AppIcon.vue'
import { useCourt } from '../lib/store.js'

const emit = defineEmits(['notice', 'open', 'compose'])
const court = useCourt()

const recordFilters = [
  { id: 'all', title: '全部' },
  { id: 'pending', title: '待复盘' },
  { id: 'skipped', title: '忍住没买' },
  { id: 'bought', title: '已购买' },
  { id: 'voted', title: '我投过的' }
]
const results = {
  pending: { label: '待复盘', color: 'badge-pending' },
  skipped: { label: '忍住没买', color: 'badge-saved' },
  bought: { label: '已购买', color: 'badge-spent' },
  buy: { label: '投了批准', color: 'badge-saved' },
  stop: { label: '投了制止', color: 'badge-spent' }
}

const recordFilter = ref('all')
const ledgerOpen = ref(false)
const ledgerToggle = ref(null)
const ledgerTitle = ref('')
const ledgerAmount = ref('')
const ledgerError = ref('')
const savingLedger = ref(false)
const membershipOpen = ref(false)

const ownCases = computed(() => court.cases.filter((item) => item.authorId === court.userId))
const skippedCases = computed(() => ownCases.value.filter((item) => item.review === 'skipped'))
const skippedCount = computed(() => skippedCases.value.length)
const reviewedCount = computed(() => ownCases.value.filter((item) => item.review === 'bought' || item.review === 'skipped').length)
const savedAmount = computed(() => skippedCases.value.reduce((cents, item) => cents + Math.round(item.price * 100), 0) / 100)
const spentAmount = computed(() => court.ledger.reduce((cents, entry) => cents + Math.round(entry.amount * 100), 0) / 100)
const skipRatio = computed(() => reviewedCount.value ? Math.round(skippedCount.value / reviewedCount.value * 100) : 0)

const visibleCases = computed(() => {
  const filter = recordFilter.value
  if (filter === 'voted') return court.cases.filter((item) => item.myVote).sort(newestFirst)
  if (filter === 'all') return [...ownCases.value].sort(newestFirst)
  return ownCases.value.filter((item) => (item.review || 'pending') === filter).sort(newestFirst)
})
const ledgerEntries = computed(() => [...court.ledger].sort(newestFirst))

function newestFirst(first, second) {
  return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
}

function formatDate(timestamp) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return '日期未知'
  return date.getFullYear() + '年' + (date.getMonth() + 1) + '月' + date.getDate() + '日'
}

function resultFor(item) {
  return results[recordFilter.value === 'voted' ? item.myVote : item.review || 'pending']
}

async function saveLedger() {
  if (!ledgerOpen.value || savingLedger.value) return
  savingLedger.value = true
  ledgerError.value = ''
  try {
    await court.addLedger({ title: ledgerTitle.value, amount: ledgerAmount.value })
    ledgerTitle.value = ''
    ledgerAmount.value = ''
    ledgerOpen.value = false
    emit('notice', '已加入消费账本')
  } catch (error) {
    ledgerError.value = error?.message || '保存失败，请重试'
  } finally {
    savingLedger.value = false
  }
  // #ifdef H5
  if (!ledgerOpen.value) {
    await nextTick()
    ledgerToggle.value?.$el?.focus()
  }
  // #endif
}
</script>

<style scoped src="./CourtProfile.css"></style>
