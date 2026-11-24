<script setup>
import { computed, ref, watch } from 'vue'
import { useCourt } from '../lib/store.js'
import AppIcon from './AppIcon.vue'

const props = defineProps({ item: { type: Object, required: true } })
const emit = defineEmits(['open', 'notice'])
const court = useCourt()
const imageUnavailable = ref(false)
const pendingVote = ref(null)

const isOwnCase = computed(() => props.item.authorId === court.userId)
const caseFinished = computed(() => Boolean(props.item.review))
const totalVotes = computed(() => props.item.buy + props.item.stop)
const buyShare = computed(() => totalVotes.value ? Math.round(props.item.buy / totalVotes.value * 100) : 0)
const stopShare = computed(() => totalVotes.value ? 100 - buyShare.value : 0)
const submittedOn = computed(() => {
  const submitted = new Date(props.item.createdAt)
  const today = new Date()
  if (submitted.toDateString() === today.toDateString()) {
    const hours = String(submitted.getHours()).padStart(2, '0')
    const minutes = String(submitted.getMinutes()).padStart(2, '0')
    return `今天 ${hours}:${minutes}`
  }
  return `${submitted.getMonth() + 1}月${submitted.getDate()}日`
})

watch(() => props.item.image, () => { imageUnavailable.value = false })

function openCase() {
  emit('open', props.item.id)
}

async function castVote(side) {
  if (pendingVote.value || props.item.myVote === side || isOwnCase.value || caseFinished.value) return
  const previousVote = props.item.myVote
  pendingVote.value = side
  try {
    await court.vote(props.item.id, side)
    emit('notice', previousVote ? '已更新投票' : '投票成功')
  } catch (error) {
    emit('notice', error.message || '投票失败，请重试')
  } finally {
    pendingVote.value = null
  }
}
</script>

<template>
  <view class="case-card">
    <view class="case-summary">
      <view class="case-image" aria-hidden="true" @click="openCase">
        <image v-if="item.image && !imageUnavailable" class="product-photo" :src="item.image" mode="aspectFill" @error="imageUnavailable = true" />
        <AppIcon v-else name="bag" :size="32" />
      </view>

      <view class="case-info">
        <view class="case-meta">
          <text class="case-category">{{ item.category }}</text>
          <text class="case-date">{{ submittedOn }}</text>
          <view v-if="item.urgent && !caseFinished" class="urgent-label">
            <AppIcon name="bolt" :size="12" />
            <text>加急</text>
          </view>
        </view>

        <view class="case-title-row">
          <button class="case-title" @click="openCase">
            <text class="case-title-text">{{ item.title }}</text>
          </button>
          <text class="case-price"><text class="price-symbol">¥</text>{{ court.money(item.price) }}</text>
        </view>

        <text class="case-reason" @click="openCase">{{ item.reason }}</text>
        <button class="case-discussion" :aria-label="`查看 ${item.title} 的 ${item.comments.length} 条评论`" @click="openCase">
          <AppIcon name="chat" :size="14" />
          <text>{{ item.comments.length }} 条评论</text>
          <AppIcon name="chevron-right" :size="12" />
        </button>
      </view>
    </view>

    <view class="case-voting">
      <view class="vote-summary">
        <text class="buy-share">{{ totalVotes ? `批准 ${buyShare}%` : '暂无投票' }}</text>
        <text class="vote-total">{{ totalVotes }} 票</text>
        <text class="stop-share">{{ totalVotes ? `制止 ${stopShare}%` : '' }}</text>
      </view>
      <view class="vote-track" aria-hidden="true">
        <view v-if="totalVotes" class="buy-track" :style="{ width: `${buyShare}%` }" />
        <view v-if="totalVotes" class="stop-track" :style="{ width: `${stopShare}%` }" />
      </view>

      <view v-if="!caseFinished && !isOwnCase" class="vote-actions">
        <button class="vote-button vote-buy" :class="{ 'vote-selected': item.myVote === 'buy' }" :disabled="Boolean(pendingVote)" :aria-pressed="item.myVote === 'buy'" :aria-label="`${item.title}，批准买`" @click="castVote('buy')">
          <AppIcon name="check" :size="16" />
          <text v-if="pendingVote === 'buy'">投票中</text>
          <text v-else>{{ item.myVote === 'buy' ? '已批准' : '批准买' }}</text>
        </button>
        <button class="vote-button vote-stop" :class="{ 'vote-selected': item.myVote === 'stop' }" :disabled="Boolean(pendingVote)" :aria-pressed="item.myVote === 'stop'" :aria-label="`${item.title}，禁止剁手`" @click="castVote('stop')">
          <AppIcon name="x" :size="16" />
          <text v-if="pendingVote === 'stop'">投票中</text>
          <text v-else>{{ item.myVote === 'stop' ? '已制止' : '禁止剁手' }}</text>
        </button>
      </view>

      <button v-else class="vote-status" @click="openCase">
        <text>{{ caseFinished ? '已结案 · 查看复盘' : '我的申请 · 查看进展' }}</text>
        <AppIcon name="chevron-right" :size="14" />
      </button>
    </view>
  </view>
</template>

<style scoped src="./CaseCard.css"></style>
