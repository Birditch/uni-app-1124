<script setup>
import { computed, ref, watch, watchPostEffect } from 'vue'
import AppIcon from './AppIcon.vue'
import { useCaseActions } from '../lib/case-actions.js'
import { relativeTime } from '../lib/format.js'
import { useCourt } from '../lib/store.js'

const props = defineProps({
  caseId: { type: String, required: true },
})
const emit = defineEmits(['back', 'notice', 'share'])
const court = useCourt()
const item = computed(() => court.cases.find((entry) => entry.id === props.caseId))
const isOwner = computed(() => item.value?.authorId === court.userId)
const totalVotes = computed(() => (item.value?.buy ?? 0) + (item.value?.stop ?? 0))
const buyPercent = computed(() => totalVotes.value ? Math.round(item.value.buy * 100 / totalVotes.value) : 0)
const stopPercent = computed(() => totalVotes.value ? 100 - buyPercent.value : 0)
const {
  advice, reportReason, reportOpen, reportedForCase, pending, liveStatus,
  castVote, postAdvice, saveReview, enableUrgency, sendReport,
} = useCaseActions({
  court,
  getCaseId: () => props.caseId,
  itemRef: item,
  onNotice: (message) => emit('notice', message),
})
const imageFailed = ref(false)
const pageElement = ref(null)

watch([() => props.caseId, () => item.value?.image], () => {
  imageFailed.value = false
})

// #ifdef H5
watchPostEffect(() => {
  // Uni mounts the actual textarea inside its custom element.
  const root = pageElement.value?.$el
  if (!root || !item.value) return
  if (!item.value.review) root.querySelector('.advice-form textarea')?.setAttribute('aria-label', '匿名劝言')
  if (reportOpen.value) root.querySelector('.report-form textarea')?.setAttribute('aria-label', '举报原因')
})
// #endif

const context = computed(() => [
  { name: 'reason', label: '心动理由', icon: 'heart', text: item.value?.reason },
  { name: 'concern', label: '主要顾虑', icon: 'scale', text: item.value?.concern },
  { name: 'alternative', label: '备选方案', icon: 'target', text: item.value?.alternative },
].filter((entry) => entry.text))

const statusLabel = computed(() => {
  if (item.value?.review === 'bought') return '已结案 · 最终下单'
  if (item.value?.review === 'skipped') return '已结案 · 成功忍住'
  return '裁决进行中'
})

function previewImage() {
  const image = item.value?.image
  if (image) uni.previewImage({ urls: [image], current: image })
}
</script>

<template>
  <view ref="pageElement" class="case-page">
    <view class="case-toolbar">
      <button class="toolbar-button back-button" role="button" tabindex="0" aria-label="返回上一页" @click="emit('back')">
        <AppIcon name="arrow-left" :size="18" />
        <text>返回</text>
      </button>
      <view v-if="item" class="toolbar-actions">
        <!-- #ifdef MP-WEIXIN -->
        <button class="toolbar-button" open-type="share">
          <AppIcon name="share" :size="17" />
          <text>分享</text>
        </button>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <button class="toolbar-button" role="button" tabindex="0" @click="emit('share', item.id)">
          <AppIcon name="share" :size="17" />
          <text>分享</text>
        </button>
        <!-- #endif -->
      </view>
    </view>

    <view v-if="item" class="case-layout">
      <view class="case-card case-overview">
        <button
          v-if="item.image && !imageFailed"
          class="product-image"
          role="button"
          tabindex="0"
          aria-label="查看商品图片"
          @click="previewImage"
        >
          <image :src="item.image" mode="aspectFill" @error="imageFailed = true" />
        </button>
        <view v-else class="product-image product-placeholder" aria-hidden="true">
          <AppIcon name="bag" :size="44" />
        </view>

        <view class="overview-body">
          <view class="case-tags">
            <text class="case-category">{{ item.category }}</text>
            <text v-if="item.urgent && !item.review" class="case-urgent">
              <AppIcon name="bolt" :size="13" />加急
            </text>
          </view>
          <text class="case-title" role="heading" aria-level="1">{{ item.title }}</text>
          <view class="case-meta">
            <AppIcon name="user" :size="15" />
            <text>{{ isOwner ? '我的匿名申请' : item.author }}</text>
            <text class="meta-divider" aria-hidden="true">·</text>
            <text>{{ relativeTime(item.createdAt) }}</text>
          </view>
          <view class="amounts">
            <view class="amount">
              <text class="amount-label">商品价格</text>
              <text class="amount-value amount-price"><text class="currency">¥</text>{{ court.money(item.price) }}</text>
            </view>
            <view v-if="item.budget !== null && item.budget !== undefined && item.budget !== ''" class="amount">
              <text class="amount-label">消费预算</text>
              <text class="amount-value"><text class="currency">¥</text>{{ court.money(item.budget) }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="case-card case-vote">
        <view class="section-heading">
          <view class="section-caption">
            <view class="soft-icon context-reason" aria-hidden="true"><AppIcon name="gavel" :size="21" /></view>
            <text class="section-title" role="heading" aria-level="2">投票裁决</text>
          </view>
        </view>
        <view class="tally-meta">
          <text class="tally-status" :class="{ closed: item.review }">{{ statusLabel }}</text>
          <text class="count-label">{{ totalVotes }} 人已投票</text>
        </view>
        <view class="tally-values" aria-hidden="true">
          <view class="tally-value tally-buy">
            <text class="tally-pct">{{ buyPercent }}%</text>
            <text class="tally-label">批准购买</text>
          </view>
          <view class="tally-value tally-stop">
            <text class="tally-pct">{{ stopPercent }}%</text>
            <text class="tally-label">制止剁手</text>
          </view>
        </view>
        <view
          class="tally-bar"
          role="img"
          :aria-label="`批准购买 ${buyPercent}%，制止剁手 ${stopPercent}%`"
        >
          <view class="tally-fill buy-fill" :style="{ width: buyPercent + '%' }" />
          <view class="tally-fill stop-fill" :style="{ width: stopPercent + '%' }" />
        </view>

        <view v-if="!item.review && !isOwner" class="vote-actions">
          <button
            class="vote-button vote-buy"
            :class="{ selected: item.myVote === 'buy' }"
            role="button"
            :tabindex="pending ? -1 : 0"
            :aria-disabled="!!pending"
            :aria-pressed="item.myVote === 'buy'"
            :disabled="!!pending"
            @click="castVote('buy')"
          >
            <AppIcon name="check" :size="18" />
            <text>批准购买</text>
          </button>
          <button
            class="vote-button vote-stop"
            :class="{ selected: item.myVote === 'stop' }"
            role="button"
            :tabindex="pending ? -1 : 0"
            :aria-disabled="!!pending"
            :aria-pressed="item.myVote === 'stop'"
            :disabled="!!pending"
            @click="castVote('stop')"
          >
            <AppIcon name="x" :size="18" />
            <text>制止剁手</text>
          </button>
        </view>
        <text v-if="item.review" class="section-hint">裁决已封存，以上为结案票数。</text>
        <text v-else-if="isOwner" class="section-hint">裁决票由其他裁判投出。你可以在下方记录最后的决定。</text>
        <text v-else-if="item.myVote" class="section-hint">已投{{ item.myVote === 'buy' ? '批准购买' : '制止剁手' }}，结案前可改票。</text>
        <text v-else class="section-hint">每人一票，投票匿名。</text>
      </view>

      <view class="case-main">
        <view class="case-card case-context">
          <text class="section-title" role="heading" aria-level="2">申请陈述</text>
          <view v-for="entry in context" :key="entry.name" class="context-item">
            <view class="soft-icon" :class="'context-' + entry.name" aria-hidden="true">
              <AppIcon :name="entry.icon" :size="19" />
            </view>
            <view class="context-body">
              <text class="context-label">{{ entry.label }}</text>
              <text class="case-copy">{{ entry.text }}</text>
            </view>
          </view>
        </view>

        <view class="case-card case-discussion">
          <view class="section-heading">
            <view class="section-caption">
              <view class="discussion-icon" aria-hidden="true"><AppIcon name="chat" :size="21" /></view>
              <text class="section-title" role="heading" aria-level="2">匿名劝言</text>
            </view>
            <text class="count-label">{{ item.comments.length }} 条</text>
          </view>
          <view v-if="!item.review" class="advice-form">
            <textarea
              v-model="advice"
              class="case-textarea"
              aria-label="匿名劝言"
              placeholder="如果是你，你会怎么选？"
              placeholder-style="color: #938782"
              :maxlength="200"
              :disabled="pending === 'comment'"
            />
            <view class="advice-actions">
              <text class="count-label">{{ advice.length }}/200</text>
              <button
                class="case-primary"
                role="button"
                :tabindex="!advice.trim() || pending ? -1 : 0"
                :aria-disabled="!advice.trim() || !!pending"
                :disabled="!advice.trim() || !!pending"
                @click="postAdvice"
              >
                {{ pending === 'comment' ? '发布中…' : '发送劝言' }}
              </button>
            </view>
          </view>
          <text v-else class="section-hint">申请已结案，现有劝言仍可查看。</text>

          <view v-if="item.comments.length" class="advice-list">
            <view v-for="comment in item.comments" :key="comment.id" class="advice-entry">
              <view class="advice-avatar" aria-hidden="true"><AppIcon name="user" :size="17" /></view>
              <view class="advice-body">
                <view class="advice-meta">
                  <text class="advice-name">{{ comment.author }}</text>
                  <text class="count-label">{{ relativeTime(comment.createdAt) }}</text>
                </view>
                <text class="case-copy">{{ comment.text }}</text>
              </view>
            </view>
          </view>
          <text v-else class="no-advice">{{ item.review ? '这份申请没有收到劝言。' : '还没有劝言，来聊聊你怎么看。' }}</text>
        </view>
      </view>

      <view class="case-side">
        <view v-if="isOwner" class="case-card case-review">
          <view class="section-caption">
            <view class="soft-icon context-alternative" aria-hidden="true"><AppIcon name="circle-check" :size="20" /></view>
            <text class="section-title" role="heading" aria-level="2">消费复盘</text>
          </view>
          <text class="review-copy">{{ item.review ? '可以更正结果，账本会随记录同步更新。' : '记录最后的选择。结案后停止投票和评论，下单金额会同步到账本。' }}</text>
          <view class="review-actions">
            <button
              class="review-button"
              :class="{ selected: item.review === 'skipped' }"
              role="button"
              :tabindex="pending ? -1 : 0"
              :aria-disabled="!!pending"
              :aria-pressed="item.review === 'skipped'"
              :disabled="!!pending"
              @click="saveReview('skipped')"
            >成功忍住</button>
            <button
              class="review-button"
              :class="{ selected: item.review === 'bought' }"
              role="button"
              :tabindex="pending ? -1 : 0"
              :aria-disabled="!!pending"
              :aria-pressed="item.review === 'bought'"
              :disabled="!!pending"
              @click="saveReview('bought')"
            >最终下单</button>
          </view>
        </view>

        <view v-if="isOwner && !item.review" class="case-card case-priority">
          <view class="section-caption">
            <view class="soft-icon context-concern" aria-hidden="true"><AppIcon name="bolt" :size="20" /></view>
            <text class="section-title" role="heading" aria-level="2">加急裁决</text>
          </view>
          <text class="review-copy">{{ item.urgent ? '申请已加入加急队列，在大厅优先展示。' : '免费体验加急演示，让申请在大厅优先展示。' }}</text>
          <button
            v-if="!item.urgent"
            class="review-button priority-button"
            role="button"
            :tabindex="pending ? -1 : 0"
            :aria-disabled="!!pending"
            :disabled="!!pending"
            @click="enableUrgency"
          >
            {{ pending === 'urgent' ? '处理中…' : '体验加急' }}
          </button>
        </view>

        <view v-if="!isOwner" class="case-report">
          <button
            class="toolbar-button report-button"
            role="button"
            :tabindex="reportedForCase || pending ? -1 : 0"
            :aria-disabled="reportedForCase || !!pending"
            :aria-expanded="reportOpen"
            :disabled="reportedForCase || !!pending"
            @click="reportOpen = !reportOpen"
          >
            <AppIcon name="flag" :size="16" />
            <text>{{ reportedForCase ? '已举报' : '举报申请' }}</text>
          </button>
          <view v-if="reportOpen" class="case-card report-form">
            <text class="context-label">举报原因</text>
            <textarea
              v-model="reportReason"
              class="case-textarea"
              aria-label="举报原因"
              placeholder="说明低俗、诈骗等具体问题"
              placeholder-style="color: #938782"
              :maxlength="120"
              :disabled="pending === 'report'"
            />
            <view class="advice-actions">
              <button class="toolbar-button" role="button" tabindex="0" @click="reportOpen = false">取消</button>
              <button
                class="case-primary"
                role="button"
                :tabindex="!reportReason.trim() || pending ? -1 : 0"
                :aria-disabled="!reportReason.trim() || !!pending"
                :disabled="!reportReason.trim() || !!pending"
                @click="sendReport"
              >提交举报</button>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view v-else class="case-card case-missing">
      <view class="soft-icon context-reason" aria-hidden="true"><AppIcon name="inbox" :size="24" /></view>
      <text class="section-title" role="heading" aria-level="1">找不到这份申请</text>
      <text class="section-hint">返回大厅查看其他消费申请。</text>
      <button class="case-primary" role="button" tabindex="0" @click="emit('back')">回到上一页</button>
    </view>
    <text class="screen-reader-status" aria-live="polite">{{ liveStatus }}</text>
  </view>
</template>

<style scoped src="./CaseDetail.css"></style>
