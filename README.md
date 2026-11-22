# 🍊 Tesla × SpaceX 合并追踪

跟踪 Tesla 与 SpaceX（代码 SPCX）的合并探讨：今日简报、已确认与传闻的里程碑、马斯克在 X 上的发言，以及 TSLA 的价格和一段关于股价、期权的简报。

页面是静态的，全部从 `data/` 里的 JSON 渲染，没有服务器。默认简体中文，右上角 **中 / EN** 切换，选择记在浏览器的 `localStorage`（键名 `spcx-lang`）。

作者：🍊 大橙子 · [@0xVeryBigOrange](https://x.com/0xVeryBigOrange)

网站（合并并打开 GitHub Pages 之后）：<https://0xverybigorange.github.io/tesla-spacex-merger/>

> 只整理公开信息，不构成投资、法律或税务建议。

## 页面

1. **今日简报。** 读 `data/briefing.json`。顶部时间是 `updated_at`，按亚洲/新加坡显示。
2. **最新进展。** 人工里程碑在 `data/timeline.json`，每条带 `confirmed`（已确认）或 `rumor`（传闻）。下面是自动抓取的新闻，读 `data/news.json`，新的在前，标题保持来源语言。
3. **马斯克在 X 上的发言。** 读 `data/musk_posts.json`。
4. **TSLA 影响。** 最新价、较前收涨跌、约三个月日线，读 `data/tsla.json`。股价和期权的文字分析在简报的 `tsla_analysis` 里，不由自动任务改写。

## 数据怎么分工

| 文件 | 谁写 | 自动任务会不会覆盖 |
| --- | --- | --- |
| `data/briefing.json` | 人工，按日更新 | 不会 |
| `data/timeline.json` | 人工 | 不会 |
| `data/musk_posts.json` | 人工 | 不会 |
| `data/news.json` | `scripts/fetch_data.py` | 会，仅此文件 |
| `data/tsla.json` | `scripts/fetch_data.py` | 会，仅此文件 |

人工文件里，每一段给人读的文字都是 `{"zh": "...", "en": "..."}`。来源名、网址、日期、状态这种字段保持原样，不拆成两种语言。

新闻来自 Google News RSS，不需要密钥。查询是 `Tesla SpaceX merger`、`SpaceX Tesla merger talks`、`特斯拉 SpaceX 合并`。同一标题只留一条，只保留最近 60 天，最多 30 条。

TSLA 行情来自 Yahoo Finance chart 接口（无密钥），日线、约三个月。交易日按纽约日期标注，因为接口的时间戳是纽约 09:30，换算到新加坡已经是下一天。涨跌是最近两根日线收盘的差，不是盘中临时字段。

价格和标题没有变化时，脚本不改文件，工作流也就不会提交。

## 人工文件的格式

### `data/briefing.json`

```json
{
  "as_of": "2026-11-22",
  "updated_at": "2026-11-22T14:00:00+08:00",
  "headline": { "zh": "一句话", "en": "One sentence" },
  "summary": { "zh": "短简报", "en": "Short brief" },
  "points": [
    { "zh": "要点", "en": "Point" }
  ],
  "tsla_analysis": { "zh": "股价与期权", "en": "Stock and options" }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `as_of` | `YYYY-MM-DD` | 这份简报覆盖到哪一天 |
| `updated_at` | 带时区的 ISO 8601 | 页面顶部的「简报更新」，按亚洲/新加坡显示 |
| `headline` | `{zh, en}` | 简报标题 |
| `summary` | `{zh, en}` | 短摘要，可以是一段 |
| `points` | `{zh, en}` 的数组 | 至少一条 |
| `tsla_analysis` | `{zh, en}` | TSLA 与期权的分析。段落之间空一行 |

### `data/timeline.json`

```json
{
  "as_of": "2026-11-22",
  "updated_at": "2026-11-22T14:00:00+08:00",
  "items": [
    {
      "date": "2026-11-20",
      "status": "confirmed",
      "title": { "zh": "标题", "en": "Title" },
      "summary": { "zh": "经过", "en": "What happened" },
      "source": "BBC; Reuters",
      "url": "https://example.com/story"
    }
  ]
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `as_of` / `updated_at` | 同简报 | |
| `items` | 数组 | 页面按 `date` 从新到旧排，同一天保持文件里的顺序 |
| `items[].date` | `YYYY-MM-DD` | 事件日期，不当作时区瞬间 |
| `items[].status` | `"confirmed"` 或 `"rumor"` | 页面上是「已确认」或「传闻」 |
| `items[].title` / `summary` | `{zh, en}` | |
| `items[].source` | 字符串 | 来源名称，不翻译 |
| `items[].url` | `https://` 网址 | |

### `data/musk_posts.json`

```json
{
  "as_of": "2026-11-22",
  "updated_at": "2026-11-22T14:00:00+08:00",
  "intro": { "zh": "说明", "en": "Note" },
  "posts": [
    {
      "date": "2026-11-19T08:51:57.000Z",
      "url": "https://x.com/elonmusk/status/2123338476934627352",
      "kind": "repost",
      "text": { "zh": "译文", "en": "Original text" },
      "note": { "zh": "可选", "en": "Optional" }
    }
  ]
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `intro` | `{zh, en}` | 这一栏开头的说明 |
| `posts[].date` | ISO 8601 | 原帖时间，页面换成亚洲/新加坡 |
| `posts[].url` | `https://` | 马斯克这条帖子的链接 |
| `posts[].kind` | `"post"`、`"repost"` 或 `"reply"` | 原创、转发、回复 |
| `posts[].text` | `{zh, en}` | `en` 用原帖文字，`zh` 是译文 |
| `posts[].note` | `{zh, en}`，可省略 | 为什么把它放进来。不要写成帖子里没有的事实 |

## 自动文件的格式

这两个文件由脚本生成。手改会被下一次抓取覆盖。

### `data/news.json`

```json
{
  "fetched_at": "2026-11-22T14:00:00+08:00",
  "queries": ["Tesla SpaceX merger", "SpaceX Tesla merger talks", "特斯拉 SpaceX 合并"],
  "items": [
    {
      "title": "Headline in the source language",
      "url": "https://news.google.com/rss/articles/...",
      "source": "Reuters",
      "published_at": "2026-11-20T23:04:00+08:00",
      "query": "Tesla SpaceX merger"
    }
  ]
}
```

`items` 从新到旧。`title` 不翻译。

### `data/tsla.json`

```json
{
  "symbol": "TSLA",
  "currency": "USD",
  "source": "Yahoo Finance chart",
  "source_url": "https://query1.finance.yahoo.com/v8/finance/chart/TSLA?range=3mo&interval=1d&includePrePost=false",
  "fetched_at": "2026-11-22T14:00:00+08:00",
  "price": 345.82,
  "previous_close": 374.41,
  "change": -28.59,
  "change_percent": -7.64,
  "trading_date": "2026-11-20",
  "market_time": "2026-11-20T21:00:01+00:00",
  "exchange": "NasdaqGS",
  "day_high": 373.88,
  "day_low": 344.33,
  "volume": 45986617,
  "history": [
    { "date": "2026-08-21", "close": 362.86 }
  ]
}
```

`history` 按日期从早到晚，大约三个月的日收盘。`day_high`、`day_low`、`volume`、`market_time` 在接口有值时才出现。`previous_close` 是上一根日线的收盘，`change` 是 `price - previous_close`。

## 自动更新

`.github/workflows/update.yml`

- 每 2 小时一次（`17 */2 * * *`，UTC），也可以在 Actions 里手动 Run workflow。
- 只跑在 `main`。
- 只允许提交 `data/news.json` 和 `data/tsla.json`。如果工作区里三个人工文件有改动，任务直接失败，不会提交。
- 内容没变就不提交。
- 用 `GITHUB_TOKEN` 推送不会再次触发别的工作流，所以这个任务在数据有变化时自己部署 Pages。手动运行即使数据没变也会部署一次。
- 不使用任何 API 密钥。

`.github/workflows/pages.yml` 在有人把提交推进 `main` 时部署（人工更新简报、时间线、帖子，或改页面时）。机器人那次推送不会触发它。

本地：

```bash
python3 scripts/fetch_data.py --self-test
python3 scripts/fetch_data.py
python3 -m http.server 4173
```

打开 <http://127.0.0.1:4173/> 。`--dry-run` 只打印、不写文件。

## 打开 GitHub Pages

仓库需要把 Pages 的构建来源改成 GitHub Actions。这一步在仓库设置里，合并之前做不了发布。

1. 把本分支合并进 `main`。
2. 打开 <https://github.com/0xVeryBigOrange/tesla-spacex-merger/settings/pages> 。
3. **Build and deployment → Source** 选 **GitHub Actions**。不要选 Deploy from a branch。
4. 合并进 `main` 会跑 **Deploy GitHub Pages**。如果当时还没改 Source，这次会失败；改完之后到 Actions 里打开这次运行，选 Re-run，或者手动 Run workflow。
5. 发布地址：<https://0xverybigorange.github.io/tesla-spacex-merger/>

定时任务要等工作流文件已经在 `main` 上才会按点运行。GitHub 的定时任务偶尔会推迟。想马上刷新，就手动跑 **Update news and TSLA**。

在 Pages 还没改成 GitHub Actions 之前，部署那一步会失败，抓取和提交不受影响：更新任务把提交和部署拆开了。
