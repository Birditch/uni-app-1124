'use strict'

const { CourtError } = require('./shared.js')

const categories = ['数码科技', '穿搭美妆', '兴趣爱好', '日常生活', '其他']
const themes = ['green', 'mint', 'coral', 'peach', 'purple', 'violet', 'lavender', 'yellow', 'cream', 'blue']
const iconNames = ['coffee', 'shopping-bag', 'bag', 'leaf', 'target', 'heart', 'wallet', 'sparkles', 'book', 'flame', 'shirt', 'gamepad', 'cup', 'box']
const moderation = /(?:色情招揽|裸聊|色情网|招嫖|走私枪支|出售毒品|代开假发票|代办假证|出售个人信息|博彩下注|killyourself)/iu
const recordIdPattern = /^[a-f\d]{32}$/
const tokenPattern = /^[a-f\d]{64}$/
const requestIdPattern = /^[A-Za-z0-9_-]{12,100}$/

function text(value, name, max, required = true) {
  if (typeof value !== 'string' && value != null) {
    throw new CourtError('VALIDATION', `${name}必须是文字`)
  }
  const normalized = (value ?? '').trim()
  const length = Array.from(normalized).length
  if ((required && !length) || length > max) {
    throw new CourtError('VALIDATION', required ? `请填写 ${max} 字以内的${name}` : `${name}不能超过 ${max} 字`)
  }
  return normalized
}

function publicText(value, name, max, required) {
  const normalized = text(value, name, max, required)
  if (moderation.test(normalized.normalize('NFKC').replace(/\s/gu, ''))) {
    throw new CourtError('MODERATION', `${name}含有不适合公开发布的内容，请修改后重试`)
  }
  return normalized
}

function amount(value, name, allowZero = false) {
  if (!['string', 'number'].includes(typeof value) || !/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(String(value).trim())) {
    throw new CourtError('VALIDATION', `${name}须为最多两位小数的有效金额`)
  }
  const number = Number(value)
  if (number < (allowZero ? 0 : 0.01) || number > 1_000_000) {
    throw new CourtError('VALIDATION', `${name}超出可填写范围`)
  }
  return Math.round(number * 100)
}

function validRecordId(value) {
  return typeof value === 'string' && recordIdPattern.test(value)
}

function checkedId(value) {
  if (!validRecordId(value)) throw new CourtError('NOT_FOUND', '这条记录不存在或已下架')
  return value
}

function imageBuffer(image) {
  if (!image) return null
  const maxBytes = 768 * 1024
  const wrongFormat = () => new CourtError('VALIDATION', '请上传 768 KB 以内的 JPG、PNG 或 WebP 图片')
  if (typeof image !== 'string' || image.length > (maxBytes * 4 / 3) + 64) throw wrongFormat()
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image)
  if (!match) throw wrongFormat()
  const bytes = Buffer.from(match[2], 'base64')
  const extension = match[1] === 'jpeg' ? 'jpg' : match[1]
  const signatures = {
    jpg: bytes.subarray(0, 3).toString('hex') === 'ffd8ff',
    png: bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a',
    webp: bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP',
  }
  if (bytes.length > maxBytes || !signatures[extension]) throw wrongFormat()
  return { bytes, extension }
}

module.exports = {
  categories, themes, iconNames, tokenPattern, requestIdPattern,
  text, publicText, amount, validRecordId, checkedId, imageBuffer,
}
