<script setup>
import AppShell from '../../components/AppShell.vue'
import CaseComposer from '../../components/CaseComposer.vue'
import { useCourt } from '../../lib/store.js'
import { goBack, openDetail, openHome, showNotice } from '../../lib/navigation.js'

const court = useCourt()
</script>

<template>
  <AppShell :mode="court.mode" composing @navigate="openHome">
    <CaseComposer @back="goBack" @notice="showNotice" @created="openDetail($event, true)" />
  </AppShell>
</template>
