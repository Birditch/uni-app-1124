<script setup>
import { ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import AppShell from '../../components/AppShell.vue'
import CourtFeed from '../../components/CourtFeed.vue'
import CourtRanking from '../../components/CourtRanking.vue'
import CourtGroups from '../../components/CourtGroups.vue'
import CourtProfile from '../../components/CourtProfile.vue'
import { useCourt } from '../../lib/store.js'
import { openCompose, openDetail, showNotice } from '../../lib/navigation.js'

const tabs = ['feed', 'ranking', 'groups', 'profile']
const tab = ref('feed')
const court = useCourt()

function navigate(next) {
  if (!tabs.includes(next) || next === tab.value) return
  tab.value = next
  uni.pageScrollTo({ scrollTop: 0, duration: 0 })
}

onLoad((options) => {
  if (tabs.includes(options?.tab)) tab.value = options.tab
})
onShow(() => court.refresh())
</script>

<template>
  <AppShell :active="tab" :mode="court.mode" :loading="court.loading" :error="court.error"
    @navigate="navigate" @compose="openCompose" @retry="court.refresh()">
    <CourtFeed v-show="tab === 'feed'" @open="openDetail" @compose="openCompose" @navigate="navigate" @notice="showNotice" />
    <CourtRanking v-if="tab === 'ranking'" @open="openDetail" @navigate="navigate" @notice="showNotice" />
    <CourtGroups v-if="tab === 'groups'" @notice="showNotice" />
    <CourtProfile v-if="tab === 'profile'" @open="openDetail" @compose="openCompose" @notice="showNotice" />
  </AppShell>
</template>
