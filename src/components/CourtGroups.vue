<script setup>
import { computed, reactive, ref } from 'vue'
import AppIcon from './AppIcon.vue'
import { localDateKey } from '../lib/format.js'
import { useCourt } from '../lib/store.js'

const emit = defineEmits(['notice'])
const court = useCourt()

const filters = [
  { id: 'all', label: '发现小组' },
  { id: 'mine', label: '我的小组' },
]
const themes = [
  { id: 'green', label: '薄荷', groupIcon: 'target', displayIcon: 'leaf' },
  { id: 'lavender', label: '薰衣草', groupIcon: 'shopping-bag', displayIcon: 'bag' },
  { id: 'peach', label: '蜜桃', groupIcon: 'coffee', displayIcon: 'heart' },
]
const targetOptions = [7, 14, 21, 30]
const selectedFilter = ref('all')
const showForm = ref(false)
const formError = ref('')
const creating = ref(false)
const groupActions = reactive({})
const initialDraft = () => ({ title: '', description: '', target: 7, private: false, theme: 'green' })
const draft = reactive(initialDraft())

const myGroups = computed(() => court.groups.filter(group => group.joined))
const todayGroups = computed(() => myGroups.value.filter(group => group.checkedToday || group.days < group.target))
const todayCount = computed(() => todayGroups.value.filter(group => group.checkedToday).length)
const todayProgress = computed(() => todayGroups.value.length ? todayCount.value * 100 / todayGroups.value.length : 0)
const progressCaption = computed(() => {
  if (todayGroups.value.length) return '已完成的小组挑战'
  return myGroups.value.length ? '所有挑战已完成' : '加入小组后开始记录'
})
const visibleGroups = computed(() => selectedFilter.value === 'mine'
  ? myGroups.value
  : court.groups.filter(group => !group.private))

function calendarToday() {
  if (court.mode !== 'cloud') return new Date()
  const shanghai = new Date(Date.now() + 8 * 60 * 60 * 1000)
  return new Date(shanghai.getUTCFullYear(), shanghai.getUTCMonth(), shanghai.getUTCDate())
}

function recentDays(group) {
  const today = calendarToday()
  const checks = new Set(group.checkIns || [])
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + index)
    const key = localDateKey(date)
    const checked = checks.has(key)
    const isToday = index === 6
    const weekday = '日一二三四五六'[date.getDay()]
    return { key, checked, isToday, weekday }
  })
}

function progress(group) {
  return Math.min(100, Math.max(0, Math.round(group.days * 100 / group.target)))
}

function setFilter(filter) {
  selectedFilter.value = filter
}

function openForm() {
  formError.value = ''
  showForm.value = true
}

function closeForm() {
  if (creating.value) return
  formError.value = ''
  showForm.value = false
}

async function createGroup() {
  if (creating.value) return
  creating.value = true
  formError.value = ''
  try {
    const { groupIcon } = themes.find(theme => theme.id === draft.theme)
    await court.createGroup({ ...draft, icon: groupIcon })
    Object.assign(draft, initialDraft())
    showForm.value = false
    setFilter('mine')
    emit('notice', '小组已创建，可以开始打卡了')
  } catch (error) {
    formError.value = error.message || '创建未完成，请重试'
  } finally {
    creating.value = false
  }
}

async function join(group) {
  if (groupActions[group.id]) return
  groupActions[group.id] = 'join'
  try {
    await court.joinGroup(group.id)
    emit('notice', `已加入「${group.title}」`)
  } catch (error) {
    emit('notice', error.message || '加入未完成，请重试')
  } finally {
    delete groupActions[group.id]
  }
}

async function checkIn(group) {
  if (groupActions[group.id]) return
  groupActions[group.id] = 'checkIn'
  try {
    await court.checkIn(group.id)
    const updated = court.groups.find(item => item.id === group.id)
    emit('notice', updated?.days >= group.target ? '恭喜，挑战目标达成！' : '打卡成功，今天的目标完成了')
  } catch (error) {
    emit('notice', error.message || '打卡未完成，请重试')
  } finally {
    delete groupActions[group.id]
  }
}

const groupIcons = { coffee: 'coffee', 'shopping-bag': 'bag', target: 'target' }
</script>

<template>
  <view class="groups-page">
    <view class="groups-hero">
      <view class="hero-copy">
        <view class="hero-kicker"><AppIcon name="leaf" :size="16" /><text>攒钱自律小组</text></view>
        <view class="hero-title" role="heading" aria-level="1"><text class="hero-title-line">攒钱这件小事，</text><text class="hero-title-line">一起坚持。</text></view>
        <text class="hero-description">和有同样目标的人立个约定，每天打卡，为想做的事攒下一笔钱。</text>
      </view>

      <view class="hero-progress">
        <view class="progress-head">
          <view class="progress-icon"><AppIcon name="calendar" :size="18" /></view>
          <text>今日打卡</text>
        </view>
        <view class="progress-count"><text>{{ todayCount }}</text><text class="progress-divider">/</text><text class="progress-total">{{ todayGroups.length }}</text></view>
        <text class="progress-caption">{{ progressCaption }}</text>
        <view class="hero-track" aria-hidden="true"><view class="track-fill" :style="{ width: `${todayProgress}%` }" /></view>
      </view>
    </view>

    <view class="groups-section">
      <view class="section-header">
        <view>
          <text class="section-title" role="heading" aria-level="2">小组挑战</text>
          <text class="section-description">选一个眼下想坚持的目标。</text>
        </view>
        <button v-if="!showForm" class="group-button button-create" @click="openForm">
          <AppIcon name="plus" :size="19" /><text>创建小组</text>
        </button>
      </view>

      <form v-if="showForm" class="group-form" @submit="createGroup">
        <view class="form-heading">
          <view>
            <text class="form-title" role="heading" aria-level="3">给自己立个目标</text>
            <text class="form-subtitle">创建后会自动加入，你可以从今天开始打卡。</text>
          </view>
          <button class="group-button button-close" aria-label="收起创建小组表单" :disabled="creating" @click="closeForm"><AppIcon name="x" :size="20" /></button>
        </view>

        <view class="form-fields">
          <view class="form-field">
            <label for="group-name" class="field-label">小组名称</label>
            <input id="group-name" v-model="draft.title" class="field-input" type="text" aria-label="小组名称" maxlength="40" placeholder="例如：早餐自己做" placeholder-class="group-placeholder" :disabled="creating" />
          </view>
          <view class="form-field description-field">
            <label for="group-description" class="field-label">这次要坚持什么？</label>
            <textarea id="group-description" v-model="draft.description" class="field-input field-textarea" aria-label="这次要坚持什么？" maxlength="200" placeholder="例如：每天自己做早饭，省下的钱就放进旅行基金。" placeholder-class="group-placeholder" :disabled="creating" />
          </view>
          <view class="form-field">
            <text class="field-label">累计打卡目标</text>
            <view class="form-options" role="group" aria-label="累计打卡目标">
              <button v-for="days in targetOptions" :key="days" class="group-button form-option" :class="{ 'option-active': draft.target === days }" :aria-pressed="draft.target === days" :disabled="creating" @click="draft.target = days">{{ days }} 天</button>
            </view>
          </view>
          <view class="form-field">
            <text class="field-label">小组主题</text>
            <view class="form-options" role="group" aria-label="小组主题">
              <button v-for="theme in themes" :key="theme.id" class="group-button form-option theme-option" :class="[theme.id, { 'option-active': draft.theme === theme.id }]" :aria-pressed="draft.theme === theme.id" :disabled="creating" @click="draft.theme = theme.id"><AppIcon :name="theme.displayIcon" :size="16" />{{ theme.label }}</button>
            </view>
          </view>
        </view>

        <view class="form-footer">
          <button class="group-button private-toggle" :aria-pressed="draft.private" :disabled="creating" @click="draft.private = !draft.private">
            <view class="private-square" :class="{ 'private-active': draft.private }"><AppIcon :name="draft.private ? 'check' : 'lock'" :size="14" /></view>
            <view class="private-label"><text>设为私密小组</text><text class="private-description">只显示在我的小组</text></view>
          </button>
          <button class="group-button button-create" form-type="submit" :disabled="creating"><AppIcon name="plus" :size="18" /><text>{{ creating ? '正在创建…' : '创建并加入' }}</text></button>
        </view>
        <text v-if="formError" class="form-error" role="alert">{{ formError }}</text>
      </form>

      <view class="filter-bar" role="group" aria-label="小组列表筛选">
        <button v-for="filter in filters" :key="filter.id" class="group-button filter-button" :class="{ 'filter-active': selectedFilter === filter.id }" :aria-pressed="selectedFilter === filter.id" @click="setFilter(filter.id)">
          <text>{{ filter.label }}</text><text v-if="filter.id === 'mine' && myGroups.length" class="filter-count">{{ myGroups.length }}</text>
        </button>
      </view>

      <view v-if="visibleGroups.length" class="groups-grid">
        <view v-for="group in visibleGroups" :key="group.id" class="group-card" :class="group.theme">
          <view class="card-top">
            <view class="group-icon"><AppIcon :name="groupIcons[group.icon] || 'target'" :size="26" /></view>
            <view class="group-members"><AppIcon :name="group.private ? 'lock' : 'users'" :size="15" /><text>{{ group.private ? '私密小组' : `${group.members} 人参加` }}</text></view>
          </view>
          <text class="group-title" role="heading" aria-level="3">{{ group.title }}</text>
          <text v-if="group.description" class="group-description">{{ group.description }}</text>
          <view v-if="!group.private" class="group-today">
            <AppIcon name="circle-check" :size="14" />
            <text>今日 {{ group.checkedMembersToday ?? 0 }} 人已打卡</text>
          </view>

          <view v-if="group.joined" class="card-status">
            <view class="goal-label"><text>打卡进度</text><text><text class="goal-days">{{ group.days }}</text> / {{ group.target }} 天</text></view>
            <view class="goal-track" aria-hidden="true"><view class="track-fill" :style="{ width: `${progress(group)}%` }" /></view>
            <view class="recent-days" role="group" aria-label="最近七天的打卡记录">
              <view v-for="day in recentDays(group)" :key="day.key" class="day-marker" :class="{ 'day-checked': day.checked, 'day-today': day.isToday }" role="img" :aria-label="`${day.key} ${day.checked ? '已打卡' : '未打卡'}`">
                <AppIcon v-if="day.checked" name="check" :size="13" />
                <text v-else>{{ day.isToday ? '今' : day.weekday }}</text>
              </view>
            </view>
          </view>
          <view v-else class="card-status card-target"><AppIcon name="calendar" :size="16" /><text>目标累计打卡 {{ group.target }} 天</text></view>

          <button v-if="!group.joined" class="group-button button-group" :disabled="Boolean(groupActions[group.id])" @click="join(group)"><AppIcon name="plus" :size="17" /><text>{{ groupActions[group.id] === 'join' ? '正在加入…' : '加入小组' }}</text></button>
          <button v-else-if="group.days >= group.target" class="group-button button-group button-complete" disabled><AppIcon name="circle-check" :size="17" /><text>目标已达成</text></button>
          <button v-else-if="group.checkedToday" class="group-button button-group button-complete" disabled><AppIcon name="check" :size="18" /><text>今天已打卡</text></button>
          <button v-else class="group-button button-group" :disabled="Boolean(groupActions[group.id])" @click="checkIn(group)"><AppIcon name="check" :size="18" /><text>{{ groupActions[group.id] === 'checkIn' ? '正在打卡…' : '今日打卡' }}</text></button>
        </view>
      </view>

      <view v-else class="groups-empty">
        <view class="empty-icon"><AppIcon name="users" :size="30" /></view>
        <text class="empty-title">{{ selectedFilter === 'mine' ? '还没有加入小组' : '还没有公开小组' }}</text>
        <text class="empty-description">{{ selectedFilter === 'mine' ? '逛逛大家的挑战，找一个想一起做的目标。' : '定下一个小目标，邀请同路人一起坚持。' }}</text>
        <button v-if="selectedFilter === 'mine'" class="group-button button-empty" @click="setFilter('all')">发现小组<AppIcon name="arrow-right" :size="17" /></button>
        <button v-else class="group-button button-empty" @click="openForm">创建小组<AppIcon name="plus" :size="18" /></button>
      </view>
    </view>
  </view>
</template>

<style scoped src="./CourtGroups.css"></style>
