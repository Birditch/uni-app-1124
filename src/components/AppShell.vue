<script setup>
import AppIcon from './AppIcon.vue'

defineProps({
  active: { type: String, default: '' },
  mode: { type: String, default: 'demo' },
  loading: Boolean,
  error: { type: String, default: '' },
  composing: Boolean,
})
const emit = defineEmits(['navigate', 'compose', 'retry'])

const navigation = [
  { key: 'feed', icon: 'gavel', label: '裁判大厅', short: '大厅' },
  { key: 'ranking', icon: 'flame', label: '趣味榜单', short: '榜单' },
  { key: 'groups', icon: 'users', label: '自律小组', short: '小组' },
  { key: 'profile', icon: 'user', label: '我的档案', short: '我的' },
]
</script>

<template>
  <view class="shell">
    <view class="shell-header">
      <view class="shell-header-content">
        <button class="shell-brand" aria-label="买不买，返回裁判大厅" @tap="emit('navigate', 'feed')">
          <view class="shell-logo"><AppIcon name="gavel" :size="23" /></view>
          <view class="shell-wordmark">
            <text class="shell-name">买不买<text class="shell-period">.</text></text>
            <text class="shell-tagline">冲动消费裁判所</text>
          </view>
        </button>
        <view class="shell-nav shell-nav-desktop" role="navigation" aria-label="主导航">
          <button v-for="link in navigation" :key="link.key" class="shell-link"
            :class="{ 'shell-active': active === link.key }" :aria-current="active === link.key ? 'page' : undefined"
            @tap="emit('navigate', link.key)">
            <AppIcon :name="link.icon" :size="17" />
            <text>{{ link.label }}</text>
          </button>
        </view>
        <button class="shell-compose" aria-label="发起审批" @tap="emit('compose')" :disabled="composing">
          <AppIcon name="plus" :size="19" />
          <text>发起审批</text>
        </button>
      </view>
    </view>

    <view class="shell-content" role="main">
      <view v-if="error" class="shell-alert" role="alert">
        <AppIcon name="cloud-off" :size="20" />
        <text>{{ error }}</text>
        <button class="shell-retry" :disabled="loading" @tap="emit('retry')">重试</button>
      </view>
      <view v-if="loading" class="shell-loading" role="status"><text>正在加载裁判所…</text></view>
      <slot v-else />
    </view>

    <view class="shell-footer">
      <text>买不买 · 冲动消费裁判所</text>
      <view v-if="mode === 'demo'" class="shell-demo"><view />本机演示</view>
    </view>

    <view class="shell-nav shell-nav-mobile" role="navigation" aria-label="底部导航">
      <button v-for="link in navigation" :key="link.key" class="shell-link"
        :class="{ 'shell-active': active === link.key }" :aria-current="active === link.key ? 'page' : undefined"
        @tap="emit('navigate', link.key)">
        <AppIcon :name="link.icon" :size="20" />
        <text>{{ link.short }}</text>
      </button>
    </view>
  </view>
</template>

<style scoped src="./AppShell.css"></style>
