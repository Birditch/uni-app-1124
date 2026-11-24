import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

// Run against a fresh demo build with Node.js, Playwright, and Google Chrome.
// COURT_URL overrides the test origin. COURT_PLAYWRIGHT_MODULE may name an external module file.
// Set COURT_SCREENSHOTS to a directory when you want desktop and mobile screenshots.
// COURT_LOCAL_ONLY=1 blocks external requests and asserts that the app needs none.
const { chromium } = await import(process.env.COURT_PLAYWRIGHT_MODULE || 'playwright')

const url = process.env.COURT_URL || 'http://127.0.0.1:4175/'
const output = process.env.COURT_SCREENSHOTS
const localOnly = process.env.COURT_LOCAL_ONLY === '1'
const expectedOrigin = new URL(url).origin
const externalRequests = []
if (output) await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome' })

async function openContext(options = {}) {
  const context = await browser.newContext({ ...options, ...(localOnly ? { serviceWorkers: 'block' } : {}) })
  if (localOnly) {
    await context.route('**/*', (route) => {
      const requestUrl = new URL(route.request().url())
      if (requestUrl.origin === expectedOrigin) return route.continue()
      externalRequests.push(requestUrl.href)
      return route.abort('internetdisconnected')
    })
  }
  return context
}

const button = (scope, label) => {
  const withDecoration = label instanceof RegExp
    ? new RegExp(label.source.replace(/^\^/, '^[\\uE000-\\uF8FF\\s]*').replace(/\$$/, '[\\uE000-\\uF8FF\\s]*$'), label.flags)
    : label
  return scope.locator('button:visible, uni-button:visible').filter({ hasText: withDecoration }).first()
}
const screenshot = async (page, name) => {
  if (!output) return
  await page.evaluate(async () => {
    window.scrollTo(0, 0)
    await document.fonts.ready
    await Promise.all([...document.images].map(image => image.decode().catch(() => {})))
  })
  return page.screenshot({ path: resolve(output, `${name}.png`), animations: 'disabled' })
}

function monitor(page) {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`)
  })
  return errors
}

async function waitForText(scope, text) {
  await scope.getByText(text, { exact: true }).first().waitFor({ state: 'visible' })
}

async function withoutOverflow(page, name) {
  const width = await page.evaluate(() => [document.documentElement.clientWidth, document.documentElement.scrollWidth])
  assert.equal(width[1], width[0], `${name} should fit ${width[0]} CSS pixels`)
}

async function step(name, run) {
  await run()
  console.log('PASS', name)
}

async function openDesktop(capture = true) {
  const context = await openContext({
    viewport: { width: 1440, height: 1024 },
    timezoneId: 'Asia/Shanghai',
    permissions: ['clipboard-read', 'clipboard-write'],
  })
  const page = await context.newPage()
  page.setDefaultTimeout(4000)
  await page.clock.setFixedTime(new Date('2026-11-26T14:30:00+08:00'))
  const errors = monitor(page)
  await page.goto(url)
  await waitForText(page, '看看大家在纠结什么，投出你的一票。')
  if (capture) await screenshot(page, 'desktop-feed')
  return { context, page, errors }
}

function getCard(page, title) {
  return page.locator('.case-list .case-card:visible').filter({ hasText: title }).first()
}

const exampleCase = '验收用折叠水杯'
const exampleGroup = '验收私密打卡挑战'
const exampleAdvice = '可以先借室友的键盘试两天。'
const expenseTitle = '验收手动支出'
const input = (page, id) => page.locator(`input#${id}, #${id} input, textarea#${id}, #${id} textarea`).first()
const detailTitle = (page, title) => page.locator('.case-page .case-title').filter({ hasText: title })
const goBack = page => page.locator('.back-button:visible').first().click()
const home = page => page.goto(url)
const goTab = (page, label) => button(page, label).click()

try {
  const { context, page, errors } = await openDesktop()
  const keyboardTitle = '要换一把机械键盘吗？'
  const keyboard = getCard(page, keyboardTitle)
  await step('分类过滤与空状态', async () => {
    assert.equal(await page.locator('.case-card:visible').count(), 9)
    await button(page.locator('.category-list'), /^数码科技$/).click()
    assert.equal(await page.locator('.case-card:visible').count(), 2)
    await keyboard.waitFor()
    await button(page.locator('.category-list'), /^其他$/).click()
    await waitForText(page, '其他还没有申请')
    await button(page.locator('.category-list'), /^全部申请$/).click()
  })
  await step('排序并保持加急优先语义', async () => {
    assert.match(await page.locator('.case-card:visible').first().innerText(), /通勤刚两周/)
    await button(page, /^推荐排序$/).click()
    await button(page, /^最新发布$/).click()
    assert.match(await page.locator('.case-card:visible').first().innerText(), /机械键盘/)
  })
  await step('投票一次，改票不新增票数，刷新保留', async () => {
    await waitForText(keyboard, '172 票')
    await button(keyboard, /^批准买$/).click()
    await waitForText(keyboard, '173 票')
    await waitForText(keyboard, '已批准')
    await button(keyboard, /^禁止剁手$/).click()
    await waitForText(keyboard, '已制止')
    await waitForText(keyboard, '173 票')
    await page.reload()
    await waitForText(keyboard, '已制止')
    await waitForText(keyboard, '173 票')
  })
  await step('详情显示顾虑和替代方案', async () => {
    await button(keyboard, /^要换一把机械键盘吗？$/).click()
    await waitForText(page, '先借来用一周，或者给现有键盘换一套键帽。')
    await screenshot(page, 'desktop-detail')
  })

  await step('分享链接在新标签直接打开同一审批单', async () => {
    await button(page.locator('.case-toolbar'), /^分享$/).click()
    await waitForText(page, '链接已复制')
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    assert.match(copied, /#\/pages\/detail\/index\?id=case-keyboard$/)
    const recipientContext = await openContext()
    try {
      const recipient = await recipientContext.newPage()
      await recipient.goto(copied)
      await detailTitle(recipient, keyboardTitle).waitFor()
    } finally {
      await recipientContext.close()
    }
  })

  await step('发送匿名劝言与提交举报', async () => {
    await page.locator('.advice-form textarea').fill(exampleAdvice)
    await button(page, /^发送劝言$/).click()
    await waitForText(page, exampleAdvice)
    await button(page, /^举报申请$/).click()
    await page.locator('.report-form textarea').fill('这是课程验收中使用的举报模拟。')
    await button(page, /^提交举报$/).click()
    await waitForText(page, '已举报')
    await goBack(page)
  })

  await step('表单拒绝缺项，图片上传与预算预览，完成发单', async () => {
    await button(page.locator('.feed-hero'), /^发起消费申请$/).click()
    await button(page, /^匿名发布申请$/).click()
    await waitForText(page, '请填写想买的东西。')
    await input(page, 'case-title').fill(exampleCase)
    await button(page.locator('.composer'), /^日常生活$/).click()
    await input(page, 'case-price').fill('456.78')
    await input(page, 'case-budget').fill('400')
    await waitForText(page.locator('.budget-card'), '超出预算 ¥56.78')
    await input(page, 'case-reason').fill('想减少旅行时塑料水瓶的使用。')
    await input(page, 'case-concern').fill('长时间使用可能会漏水。')
    await input(page, 'case-alternative').fill('先借一个折叠水杯试用。')
    const fileDialog = page.waitForEvent('filechooser')
    await page.locator('.image-picker').click()
    await (await fileDialog).setFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1sAAAAASUVORK5CYII=', 'base64') })
    await waitForText(page, '商品截图已添加')
    await screenshot(page, 'desktop-compose')
    await button(page, /^匿名发布申请$/).click()
    await detailTitle(page, exampleCase).waitFor()
    await page.locator('.case-overview .product-image img[src^="data:image/jpeg;"]').waitFor({ state: 'visible' })
    await waitForText(page, '我的匿名申请')
  })

  await step('加急可体验，复盘买入自动入账，改为忍住移除入账', async () => {
    await button(page, /^体验加急$/).click()
    await waitForText(page, '申请已加入加急队列，在大厅优先展示。')
    await button(page, /^最终下单$/).click()
    await waitForText(page, '裁决已封存，以上为结案票数。')
    await home(page)
    await goTab(page, /^(我的|我的档案)$/)
    const firstRow = page.locator('.ledger-row').filter({ hasText: exampleCase })
    await firstRow.waitFor()
    assert.match(await firstRow.innerText(), /456\.78/)
    await button(page.locator('.record-list'), exampleCase).click()
    await button(page, /^成功忍住$/).click()
    await waitForText(page, '可以更正结果，账本会随记录同步更新。')
    await goBack(page)
    await page.locator('.ledger-list').waitFor()
    assert.equal(await firstRow.count(), 0)
  })

  await step('手动记账和数据刷新持久化', async () => {
    await button(page, /^记一笔$/).click()
    await input(page, 'ledger-title').fill(expenseTitle)
    await input(page, 'ledger-amount').fill('34.56')
    await button(page, /^保存记录$/).click()
    await waitForText(page, expenseTitle)
    await screenshot(page, 'desktop-profile')
    await home(page)
    await goTab(page, /^(我的|我的档案)$/)
    await waitForText(page, expenseTitle)
    assert.match(await page.locator('.ledger-row').filter({ hasText: expenseTitle }).innerText(), /34\.56/)
    await button(page.locator('.record-list'), exampleCase).click()
    await page.locator('.case-overview .product-image img[src^="data:image/jpeg;"]').waitFor({ state: 'visible' })
    await goBack(page)
  })

  await step('加入公开小组、当日打卡与持久化', async () => {
    await goTab(page, /^(自律小组|攒钱小组|小组)$/)
    const group = page.locator('.group-card').filter({ hasText: '衣柜优先体验周' })
    await button(group, /^加入小组$/).click()
    await button(group, /^今日打卡$/).click()
    await waitForText(group, '今天已打卡')
    assert.match(await group.innerText(), /25 人参加/)
    await waitForText(group, '今日 1 人已打卡')
    await home(page)
    await goTab(page, /^(自律小组|攒钱小组|小组)$/)
    await waitForText(group, '今天已打卡')
    assert.match(await group.innerText(), /25 人参加/)
  })

  await step('创建私密小组立即加入，并隐藏于发现列表', async () => {
    await button(page, /^创建小组$/).click()
    await input(page, 'group-name').fill(exampleGroup)
    await input(page, 'group-description').fill('每天记录一件忍住没有买的东西。')
    await button(page, /设为私密小组/).click()
    await button(page, /^创建并加入$/).click()
    const group = page.locator('.group-card').filter({ hasText: exampleGroup })
    await waitForText(group, exampleGroup)
    await button(group, /^今日打卡$/).click()
    await waitForText(group, '今天已打卡')
    await button(page, /^发现小组$/).click()
    assert.equal(await group.count(), 0)
    await screenshot(page, 'desktop-groups')
  })

  await step('趣味榜单可切换且榜单行进入详情', async () => {
    await goTab(page, /^(趣味榜单|榜单)$/)
    await button(page, /^驳回最多$/).click()
    const first = page.locator('.ladder-row').first()
    await first.waitFor()
    await waitForText(first, '已经有两双，还要抢新配色吗？')
    await button(page, /^热评最多$/).click()
    await waitForText(first, keyboardTitle)
    await screenshot(page, 'desktop-ranking')
    await first.click()
    await detailTitle(page, keyboardTitle).waitFor()
    await waitForText(page, exampleAdvice)
  })

  assert.deepEqual(errors, [], 'desktop runtime errors')
  await context.close()

  await step('320 和 390 像素下六类页面无横向溢出', async () => {
    for (const width of [320, 390]) {
      const mobile = await openContext({
        viewport: { width, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
        reducedMotion: 'reduce',
        timezoneId: 'Asia/Shanghai',
      })
      const mobilePage = await mobile.newPage()
      mobilePage.setDefaultTimeout(4000)
      await mobilePage.clock.setFixedTime(new Date('2026-11-26T14:30:00+08:00'))
      const mobileErrors = monitor(mobilePage)
      await home(mobilePage)
      await waitForText(mobilePage, '看看大家在纠结什么，投出你的一票。')
      await withoutOverflow(mobilePage, `feed ${width}`)
      await screenshot(mobilePage, `mobile-${width}-feed`)
      await button(mobilePage.locator('.feed-hero'), /^发起消费申请$/).click()
      await waitForText(mobilePage, '把你纠结的那一单，交给大家一起想想。')
      await withoutOverflow(mobilePage, `composer ${width}`)
      await screenshot(mobilePage, `mobile-${width}-composer`)
      await home(mobilePage)
      await button(getCard(mobilePage, keyboardTitle), /^要换一把机械键盘吗？$/).click()
      await detailTitle(mobilePage, keyboardTitle).waitFor()
      await withoutOverflow(mobilePage, `detail ${width}`)
      await screenshot(mobilePage, `mobile-${width}-detail`)
      await home(mobilePage)
      await goTab(mobilePage, /^(趣味榜单|榜单)$/)
      await mobilePage.locator('.ranking-page').waitFor()
      await withoutOverflow(mobilePage, `ranking ${width}`)
      await screenshot(mobilePage, `mobile-${width}-ranking`)
      await goTab(mobilePage, /^(自律小组|攒钱小组|小组)$/)
      await mobilePage.locator('.group-card').first().waitFor()
      await withoutOverflow(mobilePage, `groups ${width}`)
      await screenshot(mobilePage, `mobile-${width}-groups`)
      await goTab(mobilePage, /^我的$/)
      await mobilePage.locator('.record-list').waitFor()
      await withoutOverflow(mobilePage, `profile ${width}`)
      await screenshot(mobilePage, `mobile-${width}-profile`)
      assert.deepEqual(mobileErrors, [], `mobile ${width} runtime errors`)
      await mobile.close()
    }
  })

  await step('键盘可聚焦按钮、按 Enter 打开详情并按 Space 投票', async () => {
    const keyboardTest = await openDesktop(false)
    const testPage = keyboardTest.page
    const titleButton = button(getCard(testPage, keyboardTitle), /^要换一把机械键盘吗？$/)
    await titleButton.focus()
    assert.equal(await titleButton.evaluate(element => element === document.activeElement), true)
    assert.equal(await titleButton.getAttribute('role'), 'button')
    await titleButton.press('Enter')
    await detailTitle(testPage, keyboardTitle).waitFor()
    const voteButton = button(testPage.locator('.case-vote'), /^批准购买$/)
    await voteButton.focus()
    await voteButton.press('Space')
    await waitForText(testPage, '已投批准购买，结案前可改票。')
    await keyboardTest.context.close()
  })
  if (localOnly) assert.deepEqual(externalRequests, [], '本机演示不应发起任何外网请求')
} finally {
  await browser.close()
}
