<template>
  <view class="ranking-page">
    <view class="ranking-hero">
      <view class="ranking-hero-copy">
        <view class="week-label">
          <AppIcon name="calendar" :size="15" />
          <text>{{ weekLabel }}</text>
        </view>
        <text class="ranking-title" role="heading" aria-level="1">趣味榜单</text>
        <text class="ranking-intro">这一周，哪些消费申请让裁判们吵翻了？</text>
      </view>
      <view class="trophy-art" aria-hidden="true">
        <view class="trophy-orbit trophy-orbit-outer" />
        <view class="trophy-orbit trophy-orbit-inner" />
        <view class="trophy-plate"><AppIcon name="trophy" :size="60" /></view>
        <view class="trophy-spark trophy-spark-top"><AppIcon name="sparkles" :size="26" /></view>
        <view class="trophy-spark trophy-spark-bottom"><AppIcon name="sparkles" :size="17" /></view>
      </view>
    </view>

    <view class="ranking-layout">
      <view class="ladder-panel">
        <view class="ranking-tabs" role="group" aria-label="榜单类型">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="ranking-tab"
            :class="{ 'ranking-tab-active': activeTab === tab.id }"
            :aria-pressed="activeTab === tab.id"
            @click="activeTab = tab.id"
          >
            <AppIcon class="ranking-tab-icon" :name="tab.icon" :size="16" />
            <text>{{ tab.label }}</text>
          </button>
        </view>
        <view class="ladder-caption">
          <text>{{ selectedTab.description }}</text>
        </view>

        <view v-if="ranked.length" :key="activeTab" class="ladder-rows">
          <button
            v-for="(row, index) in ranked"
            :key="row.item.id"
            class="ladder-row"
            :aria-label="`第 ${index + 1} 名，${row.item.title}，${row.scoreLabel}，打开审批`"
            @click="emit('open', row.item.id)"
          >
            <view class="rank-position" :class="{ 'rank-gold': index === 0, 'rank-silver': index === 1, 'rank-bronze': index === 2 }">
              <text>{{ index + 1 }}</text>
            </view>
            <image v-if="row.item.image" class="rank-thumb" :src="row.item.image" mode="aspectFill" />
            <view v-else class="rank-thumb rank-thumb-empty"><AppIcon name="bag" :size="21" /></view>
            <view class="rank-case">
              <text class="rank-case-title">{{ row.item.title }}</text>
              <view class="rank-case-info">
                <text>{{ row.item.category }}</text>
                <text class="rank-case-price">¥{{ court.money(row.item.price) }}</text>
              </view>
            </view>
            <view class="rank-score">
              <text class="rank-score-value">{{ row.score }}</text>
              <text class="rank-score-unit">{{ selectedTab.unit }}</text>
            </view>
            <AppIcon class="rank-chevron" name="chevron-right" :size="16" />
          </button>
        </view>

        <view v-else class="ranking-empty">
          <view class="empty-emblem"><AppIcon :name="selectedTab.icon" :size="29" /></view>
          <text class="empty-title">{{ selectedTab.empty }}</text>
          <button class="empty-action" @click="emit('navigate', 'feed')">
            <text>去裁判大厅</text><AppIcon name="arrow-right" :size="16" />
          </button>
        </view>
      </view>

      <view class="ranking-aside">
        <view class="weekly-panel">
          <view class="weekly-heading">
            <view class="weekly-icon"><AppIcon name="trending" :size="20" /></view>
            <text role="heading" aria-level="2">本周动态</text>
          </view>
          <view class="weekly-stat">
            <text>新审批单</text><text class="weekly-stat-value">{{ weekCases.length }}</text>
          </view>
          <view class="weekly-stat">
            <text>裁判投票</text><text class="weekly-stat-value">{{ totals.votes }}</text>
          </view>
          <view class="weekly-stat">
            <text>留言评论</text><text class="weekly-stat-value">{{ totals.comments }}</text>
          </view>
        </view>
        <view class="weekly-note">
          <AppIcon class="weekly-note-icon" name="info" :size="17" />
          <text>榜单统计本周发布的审批单，每周一零点开启新一轮。</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useCourt } from '../lib/store.js'
import AppIcon from './AppIcon.vue'

const emit = defineEmits(['open', 'navigate'])
const court = useCourt()
const activeTab = ref('controversial')

const tabs = [
  {
    id: 'controversial',
    label: '最有争议',
    icon: 'scale',
    unit: '争议值',
    description: '赞成与反对各取一票配对，每对计 2 分。两边票数都高，争议值就高。',
    empty: '本周还没有引发分歧的审批',
    score: item => 2 * Math.min(item.buy, item.stop),
  },
  {
    id: 'rejected',
    label: '驳回最多',
    icon: 'shield',
    unit: '反对票',
    description: '按「禁止剁手」的票数排名，看看裁判们最想拦下哪一单。',
    empty: '本周还没有反对票',
    score: item => item.stop,
  },
  {
    id: 'discussed',
    label: '热评最多',
    icon: 'chat',
    unit: '条评论',
    description: '按评论数量排名，看看哪份审批引起最多讨论。',
    empty: '本周还没有人发表评论',
    score: item => item.comments.length,
  },
]

function startOfWeek(date) {
  const monday = new Date(date)
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function shortDate(date) {
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

const weekStart = ref(startOfWeek(new Date()))
const weekEnd = computed(() => addDays(weekStart.value, 7))
let weekTimer

function updateWeek() {
  weekStart.value = startOfWeek(new Date())
  weekTimer = setTimeout(updateWeek, Math.max(1, Number(weekEnd.value) - Date.now()))
}

onMounted(updateWeek)
onUnmounted(() => clearTimeout(weekTimer))

const weekLabel = computed(() => `${shortDate(weekStart.value)} – ${shortDate(addDays(weekStart.value, 6))}`)
const weekCases = computed(() => {
  const start = Number(weekStart.value)
  const end = Number(weekEnd.value)
  return court.cases.filter(item => item.createdAt >= start && item.createdAt < end)
})
const totals = computed(() => weekCases.value.reduce((sum, item) => ({
  votes: sum.votes + item.buy + item.stop,
  comments: sum.comments + item.comments.length,
}), { votes: 0, comments: 0 }))
const selectedTab = computed(() => tabs.find(tab => tab.id === activeTab.value))
const ranked = computed(() => weekCases.value
  .map(item => {
    const tab = selectedTab.value
    const score = tab.score(item)
    const scoreLabel = tab.id === 'discussed' ? `${score} ${tab.unit}` : `${tab.unit} ${score}`
    return { item, score, scoreLabel }
  })
  .filter(row => row.score > 0)
  .sort((first, second) => second.score - first.score || second.item.createdAt - first.item.createdAt)
  .slice(0, 10))
</script>

<style scoped src="./CourtRanking.css"></style>
