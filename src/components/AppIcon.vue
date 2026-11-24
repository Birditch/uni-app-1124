<script setup>
import { computed } from 'vue'
import { iconGlyphs } from '../lib/icon-glyphs.js'

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [String, Number], default: 20 },
  color: { type: String, default: 'inherit' },
})

const glyph = computed(() => String.fromCharCode(iconGlyphs[props.name] ?? iconGlyphs.info))
const iconStyle = computed(() => ({
  fontSize: typeof props.size === 'number' ? `${props.size}px` : props.size,
  color: props.color,
}))
</script>

<template>
  <text class="app-icon" aria-hidden="true" :style="iconStyle">{{ glyph }}</text>
</template>

<style scoped src="./AppIcon.css"></style>
