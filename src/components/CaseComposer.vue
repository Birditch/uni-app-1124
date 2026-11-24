<script setup>
import { computed, nextTick, onUnmounted, reactive, ref, watchPostEffect } from 'vue'
import AppIcon from './AppIcon.vue'
import { CATEGORIES, useCourt } from '../lib/store.js'

const emit = defineEmits(['back', 'notice', 'created'])
const court = useCourt()
const composerElement = ref(null)
const draft = reactive({ title: '', category: '', price: '', budget: '', reason: '', concern: '', alternative: '', urgent: false })
const errors = ref({})
const image = ref('')
const choosing = ref(false)
const publishing = ref(false)
let detached = false
let savedLocalImage = ''

const moneyPattern = /^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/

function validMoney(input) {
  return moneyPattern.test(input.trim()) && Number.isSafeInteger(Math.round(Number(input) * 100))
}

const budgetPreview = computed(() => {
  if (!validMoney(draft.price) || Number(draft.price) <= 0 || !validMoney(draft.budget)) return null
  const price = Number(draft.price)
  const budget = Number(draft.budget)
  const balance = Math.round((budget - price) * 100) / 100
  return {
    width: budget === 0 ? 100 : Math.min(100, price / budget * 100),
    over: balance < 0,
    text: balance < 0 ? `超出预算 ¥${court.money(-balance)}` : `预算还剩 ¥${court.money(balance)}`,
  }
})

function clearError(field) {
  if (errors.value[field]) delete errors.value[field]
}

function selectCategory(category) {
  draft.category = category
  clearError('category')
}

function toggleUrgentWithKeyboard(event) {
  // #ifdef H5
  if (event.defaultPrevented || event.repeat || !['Enter', ' '].includes(event.key)) return
  event.preventDefault()
  draft.urgent = !draft.urgent
  // #endif
}

function validate() {
  const issues = {}
  if (!draft.title.trim()) issues.title = '请填写想买的东西。'
  if (!draft.category) issues.category = '请选择商品分类。'
  if (!validMoney(draft.price) || Number(draft.price) <= 0) issues.price = '请输入大于 0 的金额，最多两位小数。'
  if (draft.budget.trim() && !validMoney(draft.budget)) issues.budget = '请输入有效预算，最多两位小数。'
  if (court.mode === 'cloud' && Number(draft.price) > 1_000_000) issues.price = '商品价格最高可填写 100 万元。'
  if (court.mode === 'cloud' && Number(draft.budget) > 1_000_000) issues.budget = '预算最高可填写 100 万元。'
  if (!draft.reason.trim()) issues.reason = '请写下至少一个购买理由。'
  errors.value = issues

  const firstField = Object.keys(issues)[0]
  if (!firstField) return true
  uni.pageScrollTo({ selector: `#case-field-${firstField}`, duration: 180, offsetTop: -88 })
  // #ifdef H5
  nextTick(() => {
    composerElement.value?.$el?.querySelector(`#case-field-${firstField} input, #case-field-${firstField} textarea, #case-field-${firstField} uni-button`)?.focus({ preventScroll: true })
  })
  // #endif
  return false
}

// #ifdef H5
watchPostEffect(() => {
  // Uni's H5 input wrappers receive ARIA attributes instead of the native controls.
  const root = composerElement.value?.$el
  if (!root) return
  for (const name of ['title', 'price', 'budget', 'reason', 'concern', 'alternative']) {
    const control = root.querySelector(`#case-${name} input, #case-${name} textarea`)
    if (!control) continue
    control.setAttribute('aria-labelledby', `case-label-${name}`)
    if (['title', 'price', 'reason'].includes(name)) control.setAttribute('aria-required', 'true')
    if (errors.value[name]) {
      control.setAttribute('aria-invalid', 'true')
      control.setAttribute('aria-describedby', `case-error-${name}`)
    } else {
      control.removeAttribute('aria-invalid')
      control.removeAttribute('aria-describedby')
    }
  }
})

async function browserImage(path) {
  const source = await new Promise((resolve, reject) => {
    const picture = new Image()
    picture.onload = () => resolve(picture)
    picture.onerror = () => reject(new Error('无法读取这张图片，请换一张。'))
    picture.src = path
  })
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('此浏览器无法处理图片。')

  for (const size of [960, 760, 540, 360]) {
    const scale = Math.min(1, size / Math.max(source.naturalWidth, source.naturalHeight))
    canvas.width = Math.max(1, Math.round(source.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(source.naturalHeight * scale))
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(source, 0, 0, canvas.width, canvas.height)
    const result = canvas.toDataURL('image/jpeg', 0.78)
    if (result.length <= 200_000) return result
  }

  throw new Error('这张图片无法压缩，请换一张。')
}
// #endif

async function chooseImage() {
  if (choosing.value || publishing.value) return
  choosing.value = true

  try {
    const result = await new Promise((resolve, reject) => {
      uni.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'], success: resolve, fail: reject })
    })
    const path = result.tempFilePaths?.[0]
    if (!path) return
    if (result.tempFiles?.[0]?.size > 10 * 1024 * 1024) throw new Error('请选择 10 MB 以内的图片。')

    let nextImage = path
    // #ifdef H5
    nextImage = await browserImage(path)
    // #endif
    removeImage()
    image.value = nextImage
  } catch (error) {
    if (!error?.errMsg?.includes('cancel')) emit('notice', error?.message || '图片选择失败，请重试。')
  } finally {
    choosing.value = false
  }
}

function removeSavedLocalImage() {
  // #ifdef MP-WEIXIN
  if (savedLocalImage) {
    uni.getFileSystemManager().removeSavedFile({ filePath: savedLocalImage, fail() {} })
  }
  // #endif
  savedLocalImage = ''
}

function removeImage() {
  removeSavedLocalImage()
  image.value = ''
}

// #ifdef MP-WEIXIN
async function smallImageData(path) {
  const files = uni.getFileSystemManager()
  const { data } = await new Promise((resolve, reject) => {
    files.readFile({ filePath: path, success: resolve, fail: reject })
  })
  const bytes = new Uint8Array(data)
  if (bytes.length > 768 * 1024) return ''
  let type = ''
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) type = 'jpeg'
  else if (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) type = 'png'
  else if (String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP') type = 'webp'
  return type ? `data:image/${type};base64,${uni.arrayBufferToBase64(data)}` : ''
}

async function cloudImage(path) {
  const original = await smallImageData(path)
  if (original) return original

  try {
    const compressed = await new Promise((resolve, reject) => {
      uni.compressImage({ src: path, quality: 60, compressedWidth: 900, success: resolve, fail: reject })
    })
    const dataUrl = await smallImageData(compressed.tempFilePath)
    if (dataUrl) return dataUrl
  } catch {
    // Compression can fail for formats unsupported by the device.
  }
  throw new Error('图片无法压缩到 768 KB 以内，请换一张 JPG、PNG 或 WebP 图片。')
}
// #endif

async function persistImage(path) {
  // #ifdef MP-WEIXIN
  if (court.mode === 'cloud') return cloudImage(path)
  if (savedLocalImage) return savedLocalImage
  const files = uni.getFileSystemManager()
  const saved = await new Promise((resolve, reject) => {
    files.saveFile({ tempFilePath: path, success: resolve, fail: reject })
  })
  // WeChat moves the temporary file. Keep the saved copy available for a retry.
  savedLocalImage = saved.savedFilePath
  image.value = savedLocalImage
  return savedLocalImage
  // #endif
  // #ifndef MP-WEIXIN
  return path
  // #endif
}

async function publish() {
  if (publishing.value || choosing.value || !validate()) return
  publishing.value = true

  try {
    const savedImage = image.value ? await persistImage(image.value) : ''
    const item = await court.createCase({ ...draft, image: savedImage })
    savedLocalImage = ''
    emit('notice', '申请已匿名发布')
    emit('created', item.id)
  } catch (error) {
    emit('notice', error?.message || '发布失败，请重试。')
  } finally {
    publishing.value = false
    if (detached) removeSavedLocalImage()
  }
}

onUnmounted(() => {
  detached = true
  if (!publishing.value) removeSavedLocalImage()
})
</script>

<template>
  <view ref="composerElement" class="composer">
    <button class="back-link" role="button" tabindex="0" @click="emit('back')">
      <AppIcon name="arrow-left" :size="17" /> 返回
    </button>

    <view class="page-heading">
      <view class="heading-icon"><AppIcon name="gavel" :size="33" /></view>
      <view>
        <text class="page-title" role="heading" aria-level="1">发起消费申请</text>
        <text class="page-description">把你纠结的那一单，交给大家一起想想。</text>
      </view>
    </view>

    <view class="composer-layout">
      <form class="composer-form" @submit="publish">
        <view class="form-card">
          <view class="form-heading">
            <view class="section-icon section-icon-coral"><AppIcon name="bag" :size="20" /></view>
            <view>
              <text class="section-title" role="heading" aria-level="2">你想买什么？</text>
              <text class="section-description">告诉裁判，这一单到底是什么。</text>
            </view>
          </view>

          <view id="case-field-title" class="field">
            <label id="case-label-title" for="case-title" class="field-label">商品名称 <text class="required" aria-hidden="true">*</text></label>
            <input id="case-title" v-model="draft.title" class="field-input" :class="{ invalid: errors.title }" :aria-invalid="Boolean(errors.title)" :aria-describedby="errors.title ? 'case-error-title' : undefined" :maxlength="50" placeholder="例如：想了三个月的机械键盘" placeholder-class="composer-placeholder" @input="clearError('title')" />
            <text v-if="errors.title" id="case-error-title" class="field-error" role="alert">{{ errors.title }}</text>
          </view>

          <view id="case-field-category" class="field">
            <text id="case-category-label" class="field-label">商品分类 <text class="required">*</text></text>
            <view class="category-list" role="group" aria-labelledby="case-category-label">
              <button v-for="category in CATEGORIES" :key="category" class="category-button" :class="{ selected: draft.category === category }" role="button" tabindex="0" :aria-pressed="draft.category === category" @click="selectCategory(category)">
                {{ category }}
              </button>
            </view>
            <text v-if="errors.category" class="field-error" role="alert">{{ errors.category }}</text>
          </view>

          <view class="money-fields">
            <view id="case-field-price" class="field">
              <label id="case-label-price" for="case-price" class="field-label">商品价格 <text class="required" aria-hidden="true">*</text></label>
              <view class="money-input" :class="{ invalid: errors.price }">
                <text class="currency" aria-hidden="true">¥</text>
                <input id="case-price" v-model="draft.price" type="digit" inputmode="decimal" :aria-invalid="Boolean(errors.price)" :aria-describedby="errors.price ? 'case-error-price' : undefined" :maxlength="12" placeholder="0.00" placeholder-class="composer-placeholder" @input="clearError('price')" />
              </view>
              <text v-if="errors.price" id="case-error-price" class="field-error" role="alert">{{ errors.price }}</text>
            </view>
            <view id="case-field-budget" class="field">
              <label id="case-label-budget" for="case-budget" class="field-label">这单预算 <text class="optional" aria-hidden="true">选填</text></label>
              <view class="money-input" :class="{ invalid: errors.budget }">
                <text class="currency" aria-hidden="true">¥</text>
                <input id="case-budget" v-model="draft.budget" type="digit" inputmode="decimal" :aria-invalid="Boolean(errors.budget)" :aria-describedby="errors.budget ? 'case-error-budget' : undefined" :maxlength="12" placeholder="最多愿意花多少" placeholder-class="composer-placeholder" @input="clearError('budget')" />
              </view>
              <text v-if="errors.budget" id="case-error-budget" class="field-error" role="alert">{{ errors.budget }}</text>
            </view>
          </view>
          <text v-if="budgetPreview" class="budget-result budget-result-mobile" :class="{ 'budget-over-text': budgetPreview.over }" role="status">{{ budgetPreview.text }}</text>
        </view>

        <view class="form-card">
          <view class="form-heading">
            <view class="section-icon section-icon-mint"><AppIcon name="chat" :size="20" /></view>
            <view>
              <text class="section-title" role="heading" aria-level="2">为什么想买？</text>
              <text class="section-description">越具体，大家的建议越贴近你的情况。</text>
            </view>
          </view>

          <view id="case-field-reason" class="field">
            <label id="case-label-reason" for="case-reason" class="field-label">心动理由 <text class="required" aria-hidden="true">*</text></label>
            <view class="textarea-wrap" :class="{ invalid: errors.reason }">
              <textarea id="case-reason" v-model="draft.reason" :aria-invalid="Boolean(errors.reason)" :aria-describedby="errors.reason ? 'case-error-reason' : undefined" :maxlength="400" placeholder="它解决什么问题？你会多常用到它？" placeholder-class="composer-placeholder" @input="clearError('reason')" />
              <text class="word-count">{{ draft.reason.length }} / 400</text>
            </view>
            <text v-if="errors.reason" id="case-error-reason" class="field-error" role="alert">{{ errors.reason }}</text>
          </view>

          <view class="optional-fields">
            <view class="field">
              <label id="case-label-concern" for="case-concern" class="field-label">还在顾虑什么 <text class="optional" aria-hidden="true">选填</text></label>
              <view class="textarea-wrap compact">
                <textarea id="case-concern" v-model="draft.concern" :maxlength="200" placeholder="例如：怕买了闲置" placeholder-class="composer-placeholder" />
                <text class="word-count">{{ draft.concern.length }} / 200</text>
              </view>
            </view>
            <view class="field">
              <label id="case-label-alternative" for="case-alternative" class="field-label">有哪些替代方案 <text class="optional" aria-hidden="true">选填</text></label>
              <view class="textarea-wrap compact">
                <textarea id="case-alternative" v-model="draft.alternative" :maxlength="200" placeholder="例如：借一个试试，或等打折" placeholder-class="composer-placeholder" />
                <text class="word-count">{{ draft.alternative.length }} / 200</text>
              </view>
            </view>
          </view>

          <view class="field">
            <text class="field-label">商品截图 <text class="optional">选填</text></text>
            <view v-if="image" class="image-panel">
              <image class="chosen-image" :src="image" mode="aspectFill" role="img" aria-label="已选择的商品截图" />
              <view class="image-details">
                <text class="image-title">商品截图已添加</text>
                <view class="image-actions">
                  <button class="text-action" role="button" :tabindex="choosing || publishing ? -1 : 0" :disabled="choosing || publishing" @click="chooseImage">更换</button>
                  <button class="text-action" role="button" :tabindex="choosing || publishing ? -1 : 0" :disabled="choosing || publishing" @click="removeImage">移除</button>
                </view>
              </view>
            </view>
            <button v-else class="image-picker" role="button" :tabindex="choosing || publishing ? -1 : 0" :disabled="choosing || publishing" @click="chooseImage">
              <view class="upload-icon"><AppIcon name="image" :size="21" /></view>
              <view class="image-details">
                <text class="image-title">{{ choosing ? '正在处理图片…' : '添加一张商品截图' }}</text>
                <text class="image-hint">图片不超过 10 MB</text>
              </view>
              <AppIcon name="plus" :size="18" />
            </button>
          </view>
        </view>

        <view class="form-card submit-card">
          <view class="urgent-setting">
            <view class="section-icon section-icon-coral"><AppIcon name="bolt" :size="20" /></view>
            <view class="urgent-copy">
              <text class="section-title">加急投票</text>
              <text class="section-description">标记后优先展示。本演示免费。</text>
            </view>
            <switch :checked="draft.urgent" color="#e84d3d" role="switch" tabindex="0" aria-label="加急投票" :aria-checked="draft.urgent" @change="draft.urgent = $event.detail.value" @keydown="toggleUrgentWithKeyboard" />
          </view>
          <view class="publish-actions">
            <button class="publish-button" form-type="submit" role="button" :tabindex="choosing || publishing ? -1 : 0" :disabled="publishing || choosing">
              <AppIcon name="gavel" :size="20" /> {{ publishing ? '正在发布…' : '匿名发布申请' }}
            </button>
            <view class="submit-note"><AppIcon name="shield" :size="15" /><text>其他用户只能看到你的匿名身份</text></view>
          </view>
        </view>
      </form>

      <view class="composer-aside">
        <view class="aside-card budget-card">
          <view class="section-icon section-icon-coral"><AppIcon name="wallet" :size="22" /></view>
          <text class="aside-title" role="heading" aria-level="2">这笔花费在预算里吗？</text>
          <text v-if="!budgetPreview" class="aside-copy">填写价格和你的预算，看看下单后还剩多少。</text>
          <view class="budget-track" aria-hidden="true">
            <view class="budget-fill" :class="{ 'budget-over': budgetPreview?.over }" :style="{ width: `${budgetPreview?.width || 0}%` }" />
          </view>
          <text v-if="budgetPreview" class="budget-result" :class="{ 'budget-over-text': budgetPreview.over }" role="status">{{ budgetPreview.text }}</text>
        </view>

        <view class="aside-card after-card">
          <view class="section-icon section-icon-mint"><AppIcon name="scale" :size="22" /></view>
          <text class="aside-title" role="heading" aria-level="2">发布之后</text>
          <view class="after-line"><AppIcon name="check" :size="16" /><text>大家会投票，也可以留言给建议。</text></view>
          <view class="after-line"><AppIcon name="check" :size="16" /><text>做完决定，记得登记买了还是没买。</text></view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped src="./CaseComposer.css"></style>
