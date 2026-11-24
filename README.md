# 买不买 · 冲动消费裁判所

「买不买」是一款校园匿名消费决策社区。购物前发起申请，邀请旁观者给出「批准买」或「禁止剁手」的建议。决定之后记录实际结果，购买金额自动入账，也可以和同伴一起打卡攒钱。

## 运行演示

需要 Node.js 18.18 或更新版本以及 npm。

```bash
npm ci
npm run dev
```

打开 [http://127.0.0.1:4175](http://127.0.0.1:4175/)。演示自带样例，发布、投票、评论、账本和打卡保存在当前浏览器或小程序。两台设备联调时使用已部署的阿里云服务空间。 [uniCloud 配置](./uniCloud-aliyun/README.md)

已有 H5 构建包时，可以在断网环境解压并运行 `python3 -m http.server 4175 --bind 127.0.0.1 --directory dist/build/h5`，然后使用同一地址。构建包已包含演示数据、字体和图片，运行时不需要安装 npm 依赖。

## 答辩演示

1. 在大厅筛选「数码科技」，给机械键盘投票，再改投另一方，观察总票数和比例。
2. 打开详情写一条劝言，然后发布自己的带图申请，填写价格、预算、顾虑和替代方案。
3. 在「我的档案」给新申请选择「已购买」，核对自动生成的账目。切换成「最后没买」并核对账本撤销及预计省下的金额。
4. 加入公开小组并完成今日打卡。再创建一个自己的目标，查看周榜中的申请。

作业材料包含立项依据、原型截图、业务规则、治理机制、技术方案和内测计划。开发报告逐项列出 17 位协作智能体及主控的交付和验收证据。 [提交版 PDF](./docs/买不买-项目立项与原型说明.pdf) · [可编辑源稿](./docs/项目立项与原型说明.md) · [开发与验收报告](./docs/开发与验收报告.md)

## 构建

```bash
npm test                 # 本地业务规则、云端模拟与断网恢复测试
npm run build:h5         # dist/build/h5
npm run build:mp-weixin  # dist/build/mp-weixin
```

H5 产物使用哈希路由，可由静态站点提供。小程序产物可导入微信开发者工具。课程演示使用 `touristappid`，正式预览和云联调使用自己的 AppID。

H5 浏览器验收脚本见 [tests/browser.spec.mjs](./tests/browser.spec.mjs)。本机安装 Playwright 和 Chrome 后可用 `node tests/browser.spec.mjs` 运行。`COURT_URL` 可指向构建版预览，`COURT_LOCAL_ONLY=1` 会屏蔽并检查外网请求。

基础功能可以直接体验。加急会提高大厅展示顺序，会员页展示权益方案，这两项均为课程演示，无真实交易。云端的举报工单和下架操作在 uniCloud 控制台处理。 [云端验收流程](./uniCloud-aliyun/README.md#双端验收)

## 许可证

本项目以 [MIT 许可证](./LICENSE) 开源。随附的第三方资源沿用各自的许可：Bricolage Grotesque 字体为 [SIL Open Font License 1.1](./src/static/fonts/Bricolage-OFL.txt)，图标字形子集来自 Lucide，为 [ISC 许可证](./src/static/fonts/Lucide-LICENSE.txt)。
