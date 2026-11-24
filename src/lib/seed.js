import { localDateKey } from './format.js'

const HOUR = 60 * 60 * 1000

// Applications from other students. Their hours are compressed into the current week so the weekly ranking has entries.
const PUBLIC_CASES = [
  {
    id: 'case-keyboard', image: 'keyboard', hours: 2,
    comments: [
      ['comment-keyboard-01', '14', 0.6, '借来写一周作业吧。只在店里敲十下和室友一起住，是两种体验。'],
      ['comment-keyboard-02', '26', 1.2, '如果只是想换外观，换键帽成本低很多。手腕不舒服的话，记得先试试不同高度。'],
    ],
    details: {
      title: '要换一把机械键盘吗？',
      category: '数码科技',
      price: 899,
      budget: 1000,
      reason: '每天对着电脑写作业和代码。试过朋友的机械键盘，手感真的很想念。',
      concern: '现在的键盘还能用。线性轴其实也不算静音，怕晚上敲字吵到室友。',
      alternative: '先借来用一周，或者给现有键盘换一套键帽。',
      buy: 67,
      stop: 105,
      authorId: 'demo-author-amber',
      author: '匿名申请人 07',
    },
  },
  {
    id: 'case-bag', image: 'bag', hours: 4,
    comments: [
      ['comment-bag-01', '15', 1.4, '带上你每天真的会背的东西试。背空包舒服，装电脑以后可不一定。'],
      ['comment-bag-02', '33', 2.7, '每天都用的东西有升级价值。先把必需功能列出来，再看看 400 元内有没有。'],
    ],
    details: {
      title: '通勤刚两周，想换个包',
      category: '穿搭美妆',
      price: 469,
      budget: 400,
      reason: '每天要带电脑、水杯和伞，之前用的帆布袋勒肩。看中的包有独立电脑夹层。',
      concern: '超过预算了，网上的评价还说空包就有点重。',
      alternative: '带着电脑去门店试背，顺便试一下同尺寸的轻量款。',
      urgent: true,
      buy: 93,
      stop: 54,
      authorId: 'demo-author-poppy',
      author: '匿名申请人 18',
    },
  },
  {
    id: 'case-camera', image: 'camera', hours: 5,
    comments: [
      ['comment-camera-01', '19', 1.8, '你想要的是一张可以带走的合照。先问班里谁有相机，再一起出相纸钱。'],
      ['comment-camera-02', '61', 3.4, '先把相纸算进旅行预算。拍立得的体验是好玩，持续成本也是真实的。'],
    ],
    details: {
      title: '旅行前想买一台拍立得',
      category: '兴趣爱好',
      price: 599,
      budget: 650,
      reason: '月底和室友去海边毕业旅行。想每个人带回一张即时洗出来的合照。',
      concern: '买相机刚好够预算，但一盒相纸拍不了几张。下次用可能就是一年后。',
      alternative: '借一台相机，或者旅行后挑最喜欢的照片冲印。',
      buy: 37,
      stop: 119,
      authorId: 'demo-author-coast',
      author: '匿名申请人 24',
    },
  },
  {
    id: 'case-headphones', image: 'headphones', hours: 8,
    comments: [
      ['comment-headphones-01', '11', 3, '你每天都用，值得实地试戴。戴眼镜的话也一起试试，耳罩压镜腿很难受。'],
    ],
    details: {
      title: '想买降噪耳机通勤用',
      category: '数码科技',
      price: 799,
      budget: 900,
      reason: '每天地铁来回两小时，车厢里听播客总得把音量调很高。',
      concern: '戴久了会不会夹头，夏天会不会太热。',
      alternative: '带现在的耳机去店里对比，试戴二十分钟再决定。',
      buy: 92,
      stop: 35,
      authorId: 'demo-author-metro',
      author: '匿名申请人 36',
    },
  },
  {
    id: 'case-sneakers', image: 'sneakers', hours: 12,
    comments: [
      ['comment-sneakers-01', '28', 7, '明天先穿那双只出门过一次的，给它一个重新上场的机会。'],
    ],
    details: {
      title: '已经有两双，还要抢新配色吗？',
      category: '穿搭美妆',
      price: 529,
      budget: 350,
      reason: '新出的奶油绿太好看，收藏夹里放了一周，今晚就要开售。',
      concern: '鞋柜里有两双功能差不多的鞋，其中还有一双只穿过一次。',
      alternative: '先用旧鞋搭三套衣服，等下个月看看自己还想不想买。',
      buy: 29,
      stop: 126,
      authorId: 'demo-author-sage',
      author: '匿名申请人 42',
    },
  },
  {
    id: 'case-lamp', image: 'lamp', hours: 18,
    comments: [
      ['comment-lamp-01', '12', 8, '夹灯很适合小桌面。买前量一下桌板厚度，确认夹子能装上。'],
    ],
    details: {
      title: '书桌需要一盏新台灯吗？',
      category: '日常生活',
      price: 189,
      budget: 220,
      reason: '期末复习经常在寝室看书，老台灯一开就有噪音，照到纸上还有一块暗影。',
      concern: '新灯能调亮度，但我的桌面不大，怕放不下底座。',
      alternative: '量好桌面，再找能夹在桌边的款式。',
      buy: 74,
      stop: 22,
      authorId: 'demo-author-moss',
      author: '匿名申请人 53',
    },
  },
]

// The reader's own applications keep their real ages and include both review outcomes.
const OWN_CASES = [
  {
    id: 'case-mine-notebook', hours: 24,
    details: {
      title: '周计划本要不要换成活页？',
      category: '日常生活',
      price: 79,
      budget: 100,
      reason: '这学期课程改动多，固定印好的周计划很难排。',
      concern: '过去已经买了两本，纸还没用完。',
      alternative: '用本子剩下的空白页试画两周，再看看格式够不够用。',
      buy: 8,
      stop: 16,
    },
  },
  {
    id: 'case-mine-bottle', hours: 51, reviewedHours: 36,
    details: {
      title: '换一个能放进包侧袋的水杯',
      category: '日常生活',
      price: 89,
      budget: 120,
      reason: '每天带水上课，旧杯子太宽，经常要拿在手里。',
      concern: '怕容量变小，中途总要接水。',
      alternative: '量好侧袋，优先挑容量接近旧杯的瘦高款。',
      buy: 31,
      stop: 9,
      review: 'bought',
    },
  },
  {
    id: 'case-mine-mystery', hours: 68, reviewedHours: 57,
    details: {
      title: '限量盲盒要端一整盒吗？',
      category: '兴趣爱好',
      price: 399,
      budget: 150,
      reason: '这一套里面有一个特别喜欢的造型。',
      concern: '其实只想要其中一个，其他的可能都闲置。',
      alternative: '等开盒后去找喜欢的单款，价格合适再买。',
      buy: 5,
      stop: 48,
      review: 'skipped',
    },
  },
]

const GROUPS = [
  {
    id: 'group-drinks',
    title: '七天少喝一杯奶茶',
    description: '想点外卖饮料时先喝水，省下的钱留给周末想做的事。',
    target: 7,
    private: false,
    members: 36,
    joined: true,
    checkedToday: false,
    days: 3,
    theme: 'green',
    icon: 'coffee',
    checkInDaysAgo: [1, 2, 3],
  },
  {
    id: 'group-closet',
    title: '衣柜优先体验周',
    description: '连续七天用已有衣服搭出门，想买的新衣先放进收藏夹。',
    target: 7,
    private: false,
    members: 24,
    joined: false,
    checkedToday: false,
    days: 0,
    theme: 'lavender',
    icon: 'shopping-bag',
    checkInDaysAgo: [],
  },
  {
    id: 'group-savings',
    title: '三十天攒钱计划',
    description: '每天把一笔原本想花的零花钱存起来，周末一起看看存了多少。',
    target: 30,
    private: false,
    members: 58,
    joined: false,
    checkedToday: false,
    days: 0,
    theme: 'peach',
    icon: 'target',
    checkInDaysAgo: [],
  },
]

function calendarDate(now, daysAgo) {
  const date = new Date(now)
  date.setDate(date.getDate() - daysAgo)
  return localDateKey(date)
}

function publicTimeScale(now) {
  const monday = new Date(now)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7)
  return Math.min(1, (now - monday.getTime()) / (18 * HOUR))
}

function makeCase({ id, image = '', comments = [], details }, createdAt) {
  return {
    id,
    image: image ? `/static/products/${image}.webp` : '',
    createdAt,
    urgent: false,
    review: null,
    myVote: null,
    comments,
    ...details,
  }
}

function publicCases(now) {
  const scale = publicTimeScale(now)
  const ago = (hours) => Math.round(now - hours * scale * HOUR)
  return PUBLIC_CASES.map((entry) => makeCase({
    ...entry,
    comments: entry.comments.map(([id, number, hours, text]) => ({
      id,
      author: `匿名裁判 ${number}`,
      text,
      createdAt: ago(hours),
    })),
  }, ago(entry.hours)))
}

function ownCases(userId, now) {
  return OWN_CASES.map(({ reviewedHours, details, ...entry }) => makeCase({
    ...entry,
    details: {
      ...details,
      authorId: userId,
      author: '匿名申请人',
      ...(reviewedHours ? { reviewedAt: now - reviewedHours * HOUR } : {}),
    },
  }, Math.round(now - entry.hours * HOUR)))
}

function seedGroups(now) {
  return GROUPS.map(({ checkInDaysAgo, ...group }) => ({
    ...group,
    checkIns: checkInDaysAgo.map((daysAgo) => calendarDate(now, daysAgo)),
  }))
}

function seedLedger(now) {
  return [
    { id: 'ledger-seed-lunch', title: '和室友吃午饭', amount: 32, createdAt: now - HOUR },
    {
      id: 'ledger-seed-bottle',
      title: '换一个能放进包侧袋的水杯',
      amount: 89,
      createdAt: now - 36 * HOUR,
      caseId: 'case-mine-bottle',
    },
  ]
}

export function createSeed(userId, now = Date.now()) {
  return {
    cases: [...publicCases(now), ...ownCases(userId, now)],
    groups: seedGroups(now),
    ledger: seedLedger(now),
    reports: [],
  }
}
