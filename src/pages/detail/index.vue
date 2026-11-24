<script setup>
import { computed, ref } from 'vue'
import { onLoad, onShow, onShareAppMessage } from '@dcloudio/uni-app'
import AppShell from '../../components/AppShell.vue'
import CaseDetail from '../../components/CaseDetail.vue'
import { useCourt } from '../../lib/store.js'
import { detailPath, goBack, openCompose, openHome, shareDetail, showNotice } from '../../lib/navigation.js'

const court = useCourt()
const caseId = ref('')
const item = computed(() => court.cases.find((entry) => entry.id === caseId.value))

onLoad((options) => { caseId.value = typeof options?.id === 'string' ? options.id : '' })
onShow(() => court.refresh(caseId.value))
onShareAppMessage(() => ({
  title: item.value ? `这件商品买不买？${item.value.title}` : '买不买 · 冲动消费裁判所',
  path: detailPath(caseId.value),
}))
</script>

<template>
  <AppShell :mode="court.mode" :loading="court.loading" :error="court.error"
    @navigate="openHome" @compose="openCompose" @retry="court.refresh(caseId)">
    <CaseDetail :case-id="caseId" @back="goBack" @notice="showNotice" @share="shareDetail" />
  </AppShell>
</template>
