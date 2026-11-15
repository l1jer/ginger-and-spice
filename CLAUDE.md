# Ginger and Spice 网站改进 — 交接说明

Claude Code 在本仓库启动时会自动读取这份文件。

## 项目背景

- 网站：https://gingerandspice.com.au/ （Gungahlin, Canberra 的中餐馆，堂食 / 外卖 / 配送 / 订位）
- 目标：改进 UI/UX、SEO、GEO/AEO（让 Google 和 ChatGPT、Perplexity 等 AI 搜索更容易读懂、引用这家店）
- 基线诊断：2026-11-15，总分 50/100（48 个检查项，自定框架，不是 Google 官方分数）
  - 技术 SEO 86 ｜ UI/UX 50 ｜ 站外与本地一致性 43 ｜ 页面内容 SEO 41 ｜ GEO/AEO 39
- 诊断报告（看板）：https://claude.ai/artifact/K2dj5cdptMipobRzsZWDZX
  改完后回到 claude.ai 的原对话复测，新一轮会加进同一份报告做前后对比。

## 代码结构要点

- 纯静态站点，**部署在 Vercel**：main 分支有新提交就自动发布，`public/` 是输出目录。`src/server.js` 是本地开发用的无依赖 Node 静态服务器，线上不跑它。
- 新页面用目录形式：`public/menu/index.html` → `/menu/`。`/menu` 会跳到 `/menu/`：线上靠 `vercel.json` 的 `trailingSlash`，本地靠 `server.js`。404 页是 `public/404.html`，两边都会用。
- 资源文件名没有内容哈希。**替换图片 / PDF 时最好换文件名**，避免浏览器和 CDN 用旧缓存。
- 菜单改动：改 `data/menu.json`（包括 `updated` 日期），再运行 `node scripts/build-menu.mjs`，会同时更新 `public/menu/index.html` 和 `public/llms-full.txt`。
- 首页的 ORDER ONLINE / Order takeaway / Book a table 按钮带 `data-glf-*` 属性，由 GloriaFood 脚本（`ewm2.js`）接管点击并弹出下单 / 订位窗口。`href` 只是脚本失败时的备用。**不要删改 `data-glf-*` 属性。**
- 前端写法参考 `modern-web-guidance` skill（`.agents/skills/modern-web-guidance`，已软链到 `.claude/skills`）。

## 已确认的店铺信息（以官网为准）

- 名称：GINGER AND SPICE（平台上常写作 "Ginger & Spice"，已写进 schema 的 alternateName）
- 地址：110 Hibberson St, Gungahlin ACT 2912
- 电话：02 6253 8721；手机 / 短信：0468 854 518
- 坐标：-35.1853985, 149.1353025
- 营业时间：
  - 周一至周四 11:00–14:30, 17:00–21:30
  - 周五、周六 11:00–14:30, 17:00–22:00
  - 周日 11:00–14:30, 17:00–21:30
  - 公众假期休息
- 外卖平台：FoodHub（gingerandspiceonline.com.au）、HungryPanda（官网已列）；DoorDash 也有店铺，官网未列（决定不加）
- Google 评分 4.0，492 条评论（官网展示的数据，会过时）
- 菜系：菜单里有 Laksa、绿 / 黄咖喱、槟城炒粿条等，所以 schema 的 servesCuisine 写 Chinese / Asian / Thai / Malaysian 有依据

## 关于结构化数据的预期

- Google 自 2023 年起只给政府 / 医疗网站显示 FAQ 富结果，Menu 也没有富结果。FAQPage、Menu 照样加（对 AI 搜索和语义理解有用），但验证用 https://validator.schema.org/ ，Rich Results Test 只用来看 Restaurant / LocalBusiness。
- 不要加自评的 AggregateRating（Google 不显示餐厅自家网站上的评论星级）。

## 任务清单

### 第一批：不依赖店主信息

- [x] 评分标题：改为 "Rated 4.0 from 492 Google reviews."
- [x] 锚点：所有备用链接统一指向 `#order`，去掉指向自身的 `id="online-order"`；`data-glf-*` 未动。（原以为有重复 id，复查后没有）
- [x] 结构化数据补全：alternateName、sameAs（FoodHub、HungryPanda）、FoodHub 的 OrderAction
- [x] HungryPanda 链接去掉 `rwg_token` 等一次性参数 → `https://aus.hungrypanda.co/shop?shopId=9726`（**待人工点击确认能打开**）
- [x] 服务器：支持 `/xxx/` 目录页、`/xxx` 301 跳转；缓存从 1 年 immutable 改为 1 天 + 后台刷新
- [x] 首屏视频：48.5 MB → 720p WebM 4.0 MB / MP4 5.6 MB，手机端 480p（2.4 / 2.7 MB）；加 poster（webp，预加载）、宽高属性；开启"减少动态效果"时暂停
- [x] 文字菜单页 `/menu/`：从 PDF 转录 30 页（129 条，含 5 条"自选步骤"），数据在 `data/menu.json`，`node scripts/build-menu.mjs` 生成页面；保留 PDF 下载；首页 Restaurant 改为 `hasMenu`，菜单页有 Menu / MenuSection / MenuItem / BreadcrumbList。样式已确认
- [x] sitemap.xml 加 /menu/，lastmod 更新为 2026-11-15

- [x] 菜单全部中英双语：原菜单没有中文的 65 道菜、13 个类别和选项补了译名，在 `data/menu.json` 里标 `zh_translated: true`，**待店主核对**
- [x] SEO 基础：`llms.txt`、404 页（noindex，服务器返回 404 状态）、菜单页 Twitter 卡片、首页图片 alt 写成具体菜名（Honey Prawn，待确认）、版权年份写进 HTML、schema 别名加"香辣屋"

### 第二批：涉及样式改动，先出预览图确认

- [x] 手机端底部固定操作栏：Call / Order / Directions（首页和菜单页，≤900px 显示，预留 iPhone 安全区）样式已确认
- [x] 首页事实摘要（About 第一段）+ 实时营业状态（首屏信息卡）。逻辑在 `public/assets/open-status.js`，按 Australia/Sydney 时区，处理午晚市休息和 ACT 公众假期。样式已确认
  - **每年更新** `open-status.js` 里的 `HOLIDAYS` 和 `HOLIDAYS_KNOWN_UNTIL`（现在到 2027-12-31）。日期来自第三方日历和新闻交叉核对，官方页面这里打不开，**请对照 ACT 政府页面核对一次**

### 第三批：SEO / AEO / GEO 收尾

- [x] FAQ 改成可折叠（原生 `<details>`，桌面端左右两栏）**样式待确认**
- [x] "Order your way" 卡片：主次按钮、具体信息、图标、外链标识、三张卡片对齐 **样式待确认**
- [x] `vercel.json`：`trailingSlash: true`，`/menu` 统一跳到 `/menu/`
- [x] `llms-full.txt`：由菜单脚本生成的纯文本完整菜单，`llms.txt` 链接到它
- [x] `dateModified`：首页和菜单页 WebPage；菜单页显示最后更新日期

### 剩余事项

- [x] FAQ 扩到 13 条（只用官网和菜单上的事实：营业时间、公众假期、宴会、北京烤鸭、川菜、素食、无麸质、花生、龙虾 / 泥蟹预订），页面和 FAQPage 同步
- [ ] 可选：拆分页面 /takeaway-delivery、/group-dining、/faq（要有足够的真实内容再上线，避免空页面）
- [ ] 菜单转录的人工核对，重点：
  - 干煸四季豆、干锅花菜的"干"（书法体像"千"）
  - 第 24 页 Green / Yellow Curry 前的 `*` 没有图例，网页上没显示
  - 第 26 页 `!Mongolian Sauce`、`!Satay Sauce` 按"含花生"处理
  - 已改正的拼写：Brasied→Braised、Galic→Garlic、Peppper→Pepper、Xo Chiken→XO Chicken、Rapbery→Raspberry 等
  - 原菜单没有中文名的菜品、类别、选项已补译名（`zh_translated: true`），请过目

### 站外（需要店主处理）

- Cvent 上的营业时间和邮编（写成了 2913）与官网不一致
- DoorDash 上的营业时间与官网不一致

## 不做的事项（已决定）

- 停车、BYO、儿童相关的 FAQ
- 配送范围、配送费、起送价
- DoorDash 店铺链接
- 真实菜品 / 店内照片

## 工作原则

- 不要编造店铺信息（菜品、价格、过敏原、停车、BYO 等）。不确定的内容先问，或者留 TODO。
- 每完成一项，在上面的清单里打勾，并记一句改了什么。
- 样式变化先出预览图，确认后再上线。
