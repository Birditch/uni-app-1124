<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { CATEGORIES, useCourt } from '../lib/store.js'
import AppIcon from './AppIcon.vue'
import CaseCard from './CaseCard.vue'

const emit = defineEmits(['open', 'compose', 'navigate', 'notice'])
const court = useCourt()
const allCategories = '全部申请'
const categories = [allCategories, ...CATEGORIES]
const sorting = ['推荐排序', '最新发布', '投票最多']
const category = ref(allCategories)
const sort = ref(0)
const sortMenuOpen = ref(false)
const sortTrigger = ref(null)
const heroError = ref(false)
const imageErrors = ref({})

function getDayStart() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

const dayStart = ref(getDayStart())
let dayTimer
onMounted(() => {
  dayTimer = setInterval(() => { dayStart.value = getDayStart() }, 60_000)
})
onUnmounted(() => clearInterval(dayTimer))

const voteCount = item => item.buy + item.stop

const visibleCases = computed(() => {
  const cases = court.cases.filter(item => category.value === allCategories || item.category === category.value)
  return cases.sort((first, second) => {
    if (sort.value === 1) return second.createdAt - first.createdAt
    if (sort.value === 2) return voteCount(second) - voteCount(first) || second.createdAt - first.createdAt
    const urgent = item => Number(Boolean(item.urgent && !item.review))
    return urgent(second) - urgent(first) || second.createdAt - first.createdAt
  })
})

const stats = computed(() => [
  { label: '今日申请', value: court.cases.filter(item => item.createdAt >= dayStart.value).length },
  { label: '正在投票', value: court.cases.filter(item => !item.review).length },
  { label: '累计投票', value: court.cases.reduce((total, item) => total + voteCount(item), 0) },
])

const popular = computed(() => {
  const monday = new Date(dayStart.value)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return court.cases
    .filter(item => item.createdAt >= monday.getTime() && voteCount(item) > 0)
    .sort((first, second) => voteCount(second) - voteCount(first) || second.createdAt - first.createdAt)
    .slice(0, 3)
})

function selectSort(index) {
  sort.value = index
  closeSort(true)
}

function closeSort(restoreFocus = false) {
  if (!sortMenuOpen.value) return
  sortMenuOpen.value = false
  if (restoreFocus) nextTick(() => sortTrigger.value?.$el?.focus?.())
}
</script>

<template>
  <view class="court-feed" @tap="closeSort()" @keydown.esc="closeSort(true)">
    <view class="feed-column">
      <view class="feed-hero">
        <view class="hero-illustration" aria-hidden="true">
          <image v-if="!heroError" src="/static/products/hero.webp" mode="aspectFit" class="hero-art" @error="heroError = true" />
          <view v-else class="hero-art-fallback">
            <AppIcon name="gavel" :size="118" />
          </view>
        </view>
        <view class="hero-content">
          <view class="hero-label">
            <AppIcon name="scale" :size="15" />
            <text>冲动消费裁判所</text>
          </view>
          <view class="hero-title" role="heading" aria-level="1">
            <text class="hero-question">买不买？</text>
            <text>交给大家裁决！</text>
          </view>
          <text class="hero-subtitle">匿名发出纠结，听听大家怎么说。</text>
          <button class="hero-action" @tap="emit('compose')">
            <AppIcon name="plus" :size="17" />
            <text>发起消费申请</text>
            <AppIcon class="hero-arrow" name="arrow-right" :size="16" />
          </button>
        </view>
      </view>

      <view class="feed-cases">
        <view class="feed-section-head">
          <view>
            <text class="feed-section-title" role="heading" aria-level="2">裁判大厅</text>
            <text class="feed-section-description">看看大家在纠结什么，投出你的一票。</text>
          </view>
          <view class="feed-sort" @tap.stop>
            <button ref="sortTrigger" class="sort-trigger" :aria-expanded="sortMenuOpen" @tap="sortMenuOpen = !sortMenuOpen">
              <AppIcon name="filter" :size="15" />
              <text>{{ sorting[sort] }}</text>
            </button>
            <view v-if="sortMenuOpen" class="sort-menu">
              <button
                v-for="(label, index) in sorting"
                :key="label"
                class="sort-option"
                :class="{ selected: index === sort }"
                :aria-pressed="index === sort"
                @tap="selectSort(index)"
              >
                <text>{{ label }}</text>
                <AppIcon v-if="index === sort" name="check" :size="14" />
              </button>
            </view>
          </view>
        </view>

        <view class="category-list" aria-label="申请分类">
          <button
            v-for="label in categories"
            :key="label"
            class="category-button"
            :class="{ selected: label === category }"
            :aria-pressed="label === category"
            @tap="category = label"
          >{{ label }}</button>
        </view>

        <view v-if="visibleCases.length" class="case-list">
          <CaseCard
            v-for="item in visibleCases"
            :key="item.id"
            :item="item"
            @open="emit('open', $event)"
            @notice="emit('notice', $event)"
          />
        </view>
        <view v-else class="feed-empty">
          <view class="empty-icon"><AppIcon name="inbox" :size="30" /></view>
          <text class="empty-title">{{ category === allCategories ? '还没有消费申请' : `${category}还没有申请` }}</text>
          <button v-if="category === allCategories" class="feed-text-button" @tap="emit('compose')">发起第一份申请</button>
          <button v-else class="feed-text-button" @tap="category = allCategories">查看全部申请</button>
        </view>
      </view>
    </view>

    <view class="feed-sidebar">
      <view class="side-card side-stats">
        <view class="side-heading">
          <view class="side-icon side-icon-coral"><AppIcon name="trending" :size="19" /></view>
          <text class="side-title" role="heading" aria-level="2">今日裁判所</text>
        </view>
        <view class="stats-grid">
          <view v-for="stat in stats" :key="stat.label" class="stats-cell">
            <text class="stats-number">{{ court.money(stat.value) }}</text>
            <text class="stats-label">{{ stat.label }}</text>
          </view>
        </view>
        <view class="stats-note">
          <AppIcon name="shield" :size="14" />
          <text>匿名发帖和投票，真实表达你的想法</text>
        </view>
      </view>

      <view class="side-card side-popular">
        <view class="side-heading">
          <view class="side-icon side-icon-orange"><AppIcon name="flame" :size="19" /></view>
          <text class="side-title" role="heading" aria-level="2">本周热门</text>
          <button class="side-link" @tap="emit('navigate', 'ranking')">
            <text>榜单</text>
            <AppIcon name="chevron-right" :size="14" />
          </button>
        </view>
        <view v-if="popular.length" class="popular-list">
          <button v-for="(item, index) in popular" :key="item.id" class="popular-item" @tap="emit('open', item.id)">
            <text class="popular-rank" :class="`rank-${index + 1}`">{{ index + 1 }}</text>
            <view class="popular-thumb">
              <image
                v-if="item.image && !imageErrors[item.id]"
                :src="item.image"
                mode="aspectFill"
                @error="imageErrors[item.id] = true"
              />
              <AppIcon v-else name="bag" :size="18" />
            </view>
            <view class="popular-info">
              <text class="popular-title">{{ item.title }}</text>
              <text class="popular-meta">{{ court.money(voteCount(item)) }} 票</text>
            </view>
            <AppIcon class="popular-arrow" name="chevron-right" :size="15" />
          </button>
        </view>
        <text v-else class="popular-empty">本周还没有收到投票的申请。</text>
      </view>

      <view class="side-card side-groups">
        <view class="side-heading">
          <view class="side-icon side-icon-green"><AppIcon name="target" :size="20" /></view>
          <text class="side-title" role="heading" aria-level="2">攒钱自律小组</text>
        </view>
        <text class="groups-description">定一个小目标，和同伴一起打卡。</text>
        <button class="groups-link" @tap="emit('navigate', 'groups')">
          <text>找个小组</text>
          <AppIcon name="arrow-right" :size="16" />
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped src="./CourtFeed.css"></style>
<style scoped src="./CourtFeedSidebar.css"></style>
