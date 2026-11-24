# 校园联调与云端模式

默认运行的是浏览器或微信小程序本地演示。要让两位同学同时使用同一批申请与打卡记录，请给应用关联一个阿里云 uniCloud 服务空间。

## 部署

1. 在 HBuilderX 导入项目，右键 `uniCloud-aliyun` 选择「关联云服务空间」，选中已创建的阿里云服务空间。
2. 运行「初始化向导」上传 `database/` 内五个集合的 Schema 与索引，并上传 `cloudfunctions/buy-or-not`。集合初始化后为空，由内测用户发布第一批真实申请。
3. 在 HBuilderX 运行项目时选择已关联的服务空间，或用 CLI 显式传入该服务空间的客户端参数。用 `.env.local` 或终端环境启用 `VITE_COURT_MODE=cloud`。`UNI_CLOUD_SPACES` 是 Uni-app CLI 读取的服务空间配置，作为终端环境变量传入。

```sh
export UNI_CLOUD_SPACES='[{"provider":"aliyun","id":"<空间 ID>","name":"<空间名称>","clientSecret":"<空间客户端 Secret>","apiEndpoint":"<API Endpoint>"}]'
export VITE_COURT_MODE=cloud
npm run dev
```

4. 在服务空间的「跨域配置」添加 H5 调试与上线所用的页面来源。微信小程序正式验证时使用自己的小程序 AppID，并按所用服务空间配置微信的合法请求域名与图片下载域名。上面的 `clientSecret` 是 Aliyun SDK 的客户端配置项，服务空间后台帐号和服务端密钥无需写入项目。

参考 [uniCloud 快速上手](https://doc.dcloud.net.cn/uniCloud/quickstart.html) · [发布 H5 报备域名](https://doc.dcloud.net.cn/uniCloud/publish.html#useinh5) · [云服务空间初始化](https://doc.dcloud.net.cn/uniCloud/init.html)

## 双端验收

- 用两个独立浏览器资料存储或两台设备打开项目。用户甲发布一条申请，用户乙刷新大厅，再投票、改票与评论。用户甲刷新后应看到最新统计，重复提交同一票选应维持票数。
- 由甲复盘「已购买」，其账本应自动出现一笔对应金额。再改为「没买」，该笔关联支出应自动撤销。乙的账本独立保存。
- 由甲建立公开小组，乙加入后连续点击两次打卡，同一北京时间日期应只累计一次。甲和乙刷新后应看到相同的今日已打卡人数，北京时间次日零点后从零开始统计。甲建立私密小组后，仅创建者可在当前原型中查看。
- 由乙举报某条申请，在云数据库 `bon-reports` 中查找 `pending` 工单。同一用户重复举报同一申请只留一张工单。审核员可在 `bon-cases` 将相应记录的 `hidden` 设为 `true` 下架，再将工单改为 `resolved`。
- 加急只改变大厅展示优先级，金额以分保存，显示按元换算。布置新服务空间后，使用两个身份完成上述流程，覆盖真实云事务与文件上传。

## 云函数接口

```js
const { result } = await uniCloud.callFunction({
  name: 'buy-or-not',
  data: { action: 'bootstrap' },
})
```

首次 `bootstrap` 返回匿名 `token` 和 `userId`，后续请求带上 `token`。`bootstrap` 的 `payload.caseId` 可指定一个通过链接进入的申请。成功响应含 `ok`、`cases`、`groups`、`ledger`，新建操作还返回 `result`。写入成功后若列表刷新失败，响应含 `refreshRequired: true`，客户端可保留现有列表并调用 `bootstrap` 重新读取。失败响应含 `ok: false`、`code` 与面向用户的 `message`。

新建申请、建立小组和手动记账可以带上顶层 `requestId`。当网络中断需要重试同一次提交时，复用原请求编号即可取得同一条记录。编号允许 12 至 100 个英文字母、数字、下划线或连字符。

| 操作 | `payload` |
| --- | --- |
| `createCase` | `title`、`category`、`price`、可选 `budget`、`reason`、`concern`、`alternative`、`image`、`urgent` |
| `vote` | `id`、`side`（`buy` / `stop`） |
| `comment` | `id`、`text` |
| `review` | `id`、`outcome`（`bought` / `skipped`） |
| `report` | `id`、`reason` |
| `enableUrgent`、`joinGroup`、`checkIn` | `id` |
| `createGroup` | `title`、`description`、`target`、`private`、可选 `theme`、`icon` |
| `addLedger` | `title`、`amount` |

云函数根据会话令牌校验身份，公开申请不会带出其他人的用户 ID 和单票列表。图片由云函数校验文件头后上传至云存储，支持 768 KiB 以内的 JPEG、PNG 和 WebP data URL。大厅和小组每次读取最近 50 条公开记录及最近 50 条个人记录，账本读取最近 100 条。每个小组可容纳 200 人，每个申请保留最多 50 条评论。

小组响应中的 `checkedMembersToday` 是北京时间当日已打卡的成员人数，包含已打卡的查看者。个人打卡日期仅向本人展示。
