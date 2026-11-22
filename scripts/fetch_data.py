#!/usr/bin/env python3
"""Fetch public news and the TSLA daily chart into data/.

Writes only:
  data/news.json
  data/tsla.json

Never reads with intent to modify, and never writes, the curated files
(data/briefing.json, data/timeline.json, data/musk_posts.json).

No API key. News comes from Google News RSS. The quote and ~3 months of
daily closes come from the Yahoo Finance chart endpoint.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
NEWS_PATH = DATA / "news.json"
TSLA_PATH = DATA / "tsla.json"
CURATED = ("briefing.json", "timeline.json", "musk_posts.json")

SGT = ZoneInfo("Asia/Singapore")
NY = ZoneInfo("America/New_York")
UTC = timezone.utc

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)

# Titles stay in the language Google returns. Locales only affect ranking.
NEWS_QUERIES = (
    {"q": "Tesla SpaceX merger", "hl": "en-US", "gl": "US", "ceid": "US:en"},
    {"q": "SpaceX Tesla merger talks", "hl": "en-US", "gl": "US", "ceid": "US:en"},
    {"q": "特斯拉 SpaceX 合并", "hl": "zh-CN", "gl": "SG", "ceid": "SG:zh-Hans"},
)
NEWS_WINDOW_DAYS = 60
NEWS_LIMIT = 30

YAHOO_URLS = (
    "https://query1.finance.yahoo.com/v8/finance/chart/TSLA"
    "?range=3mo&interval=1d&includePrePost=false",
    "https://query2.finance.yahoo.com/v8/finance/chart/TSLA"
    "?range=3mo&interval=1d&includePrePost=false",
)

GENERATED = {"news.json": NEWS_PATH, "tsla.json": TSLA_PATH}


def now_sgt() -> datetime:
    return datetime.now(SGT)


def iso_sgt(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(SGT).isoformat(timespec="seconds")


def money(value: float) -> float:
    return float(f"{float(value):.2f}")


def fetch_bytes(url: str, timeout: int = 25, limit: int = 5_000_000) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = resp.read(limit + 1)
    if len(data) > limit:
        raise RuntimeError(f"response larger than {limit} bytes")
    if not data:
        raise RuntimeError("empty response")
    return data


def ny_trading_date(ts: float) -> str:
    """Calendar date of a bar in America/New_York.

    Yahoo's daily timestamps sit at 09:30 New York, which is already the
    next calendar day in Singapore. The trading date is the New York date.
    """
    return datetime.fromtimestamp(ts, NY).date().isoformat()


def split_title(title: str, source: str) -> tuple[str, str]:
    title = re.sub(r"\s+", " ", (title or "")).strip()
    source = re.sub(r"\s+", " ", (source or "")).strip()
    match = re.search(r"^(.*)\s[-–—]\s([^-–—]{2,80})$", title)
    if not match:
        return title, source
    head, tail = match.group(1).strip(), match.group(2).strip()
    if source and tail.casefold() == source.casefold():
        return head, source
    if not source:
        return head, tail
    return title, source


def normalize_title(title: str) -> str:
    text = title.casefold()
    text = re.sub(r"[\"'“”‘’]+", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def parse_rss_date(value: str) -> datetime | None:
    if not value:
        return None
    try:
        parsed = parsedate_to_datetime(value)
    except (TypeError, ValueError, IndexError):
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def parse_rss(xml_bytes: bytes, query: str, now: datetime) -> list[dict]:
    root = ET.fromstring(xml_bytes)
    items: list[dict] = []
    cutoff = now.astimezone(UTC) - timedelta(days=NEWS_WINDOW_DAYS)
    latest = now.astimezone(UTC) + timedelta(days=1)
    for node in root.findall("./channel/item"):
        raw_title = node.findtext("title") or ""
        link = (node.findtext("link") or "").strip()
        source_node = node.find("source")
        source = (source_node.text or "").strip() if source_node is not None else ""
        title, source = split_title(raw_title, source)
        published = parse_rss_date(node.findtext("pubDate") or "")
        if not title or not link.startswith("https://") or published is None:
            continue
        if published < cutoff or published > latest:
            continue
        items.append(
            {
                "title": title,
                "url": link,
                "source": source,
                "published_at": iso_sgt(published),
                "query": query,
                "_sort": published.timestamp(),
            }
        )
    return items


def dedupe_news(items: list[dict]) -> list[dict]:
    items = sorted(items, key=lambda item: (-item["_sort"], item["title"], item["url"]))
    seen_titles: set[str] = set()
    seen_urls: set[str] = set()
    kept: list[dict] = []
    for item in items:
        title_key = normalize_title(item["title"])
        if title_key in seen_titles or item["url"] in seen_urls:
            continue
        seen_titles.add(title_key)
        seen_urls.add(item["url"])
        kept.append({k: v for k, v in item.items() if k != "_sort"})
        if len(kept) >= NEWS_LIMIT:
            break
    return kept


def fetch_news(now: datetime) -> dict:
    collected: list[dict] = []
    errors: list[str] = []
    for spec in NEWS_QUERIES:
        params = urllib.parse.urlencode(
            {
                "q": spec["q"],
                "hl": spec["hl"],
                "gl": spec["gl"],
                "ceid": spec["ceid"],
            }
        )
        url = f"https://news.google.com/rss/search?{params}"
        try:
            payload = fetch_bytes(url)
            if not payload.lstrip().startswith(b"<?xml") and b"<rss" not in payload[:400]:
                raise RuntimeError("response was not RSS")
            batch = parse_rss(payload, spec["q"], now)
            print(f"  query {spec['q']!r}: {len(batch)} items")
            collected.extend(batch)
        except (urllib.error.URLError, ET.ParseError, RuntimeError, TimeoutError) as exc:
            errors.append(f"{spec['q']}: {exc}")
    if errors and not collected:
        raise RuntimeError("; ".join(errors))
    if len(collected) < 3:
        detail = "; ".join(errors) if errors else "fewer than 3 items"
        raise RuntimeError(f"news feed too small ({detail})")
    if errors:
        print("news warning:", "; ".join(errors), file=sys.stderr)
    return {
        "fetched_at": iso_sgt(now),
        "queries": [spec["q"] for spec in NEWS_QUERIES],
        "items": dedupe_news(collected),
    }


def parse_yahoo(payload: dict, fetched_at: str) -> dict:
    chart = payload.get("chart") or {}
    error = chart.get("error")
    result = (chart.get("result") or [None])[0]
    if error or not result:
        raise RuntimeError(f"yahoo chart error: {error or 'empty result'}")
    meta = result.get("meta") or {}
    timestamps = result.get("timestamp") or []
    quote = ((result.get("indicators") or {}).get("quote") or [{}])[0]
    closes = quote.get("close") or []
    history: list[dict] = []
    for ts, close in zip(timestamps, closes):
        if ts is None or close is None:
            continue
        history.append({"date": ny_trading_date(float(ts)), "close": money(close)})
    # A session can theoretically appear twice; keep the last print.
    collapsed: dict[str, float] = {}
    for bar in history:
        collapsed[bar["date"]] = bar["close"]
    history = [{"date": day, "close": collapsed[day]} for day in sorted(collapsed)]
    if len(history) < 40:
        raise RuntimeError(f"expected about 3 months of bars, got {len(history)}")

    trading_date = history[-1]["date"]
    market_ts = meta.get("regularMarketTime")
    if market_ts:
        trading_date = ny_trading_date(float(market_ts))
    price = meta.get("regularMarketPrice")
    price = money(price if price is not None else history[-1]["close"])
    if history[-1]["date"] == trading_date and abs(history[-1]["close"] - price) < 1:
        history[-1]["close"] = price
    previous = history[-2]["close"] if len(history) >= 2 else None
    if previous is None:
        raise RuntimeError("no previous close in the chart")
    change = money(price - previous)
    change_percent = money((price - previous) / previous * 100)

    # Reject a feed that is stale by more than a long weekend plus a holiday.
    last_day = datetime.fromisoformat(history[-1]["date"]).date()
    age = datetime.now(NY).date() - last_day
    if age.days > 6:
        raise RuntimeError(f"TSLA chart is stale: last bar {history[-1]['date']}")

    out = {
        "symbol": meta.get("symbol") or "TSLA",
        "currency": meta.get("currency") or "USD",
        "source": "Yahoo Finance chart",
        "source_url": YAHOO_URLS[0],
        "fetched_at": fetched_at,
        "price": price,
        "previous_close": previous,
        "change": change,
        "change_percent": change_percent,
        "trading_date": history[-1]["date"],
        "market_time": (
            datetime.fromtimestamp(float(market_ts), UTC).isoformat(timespec="seconds")
            if market_ts
            else None
        ),
        "exchange": meta.get("fullExchangeName") or meta.get("exchangeName") or "",
        "history": history,
    }
    for key, meta_key in (
        ("day_high", "regularMarketDayHigh"),
        ("day_low", "regularMarketDayLow"),
    ):
        raw = meta.get(meta_key)
        if isinstance(raw, (int, float)) and raw > 0:
            out[key] = money(raw)
    volume = meta.get("regularMarketVolume")
    if isinstance(volume, (int, float)) and volume > 0:
        out["volume"] = int(volume)
    if out["market_time"] is None:
        del out["market_time"]
    return out


def fetch_tsla(now: datetime) -> dict:
    errors: list[str] = []
    for url in YAHOO_URLS:
        try:
            payload = json.loads(fetch_bytes(url))
            return parse_yahoo(payload, iso_sgt(now))
        except (urllib.error.URLError, json.JSONDecodeError, RuntimeError, TimeoutError, KeyError, TypeError) as exc:
            errors.append(f"{url.split('?')[0]}: {exc}")
    raise RuntimeError("; ".join(errors))


def load_json(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def news_material(doc: dict) -> object:
    return {
        "queries": doc.get("queries"),
        "items": [
            {k: item.get(k) for k in ("title", "url", "source", "published_at", "query")}
            for item in doc.get("items") or []
        ],
    }


def tsla_material(doc: dict) -> object:
    skip = {"fetched_at"}
    return {k: v for k, v in doc.items() if k not in skip}


def write_if_changed(path: Path, doc: dict, material) -> str:
    name = path.name
    if name not in GENERATED or GENERATED[name] != path:
        raise SystemExit(f"refusing to write {path}")
    if path.name in CURATED:
        raise SystemExit(f"refusing to write curated file {path.name}")
    old = load_json(path)
    if old is not None and material(old) == material(doc):
        return "unchanged"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return "updated"


def assert_curated_untouched(before: dict[str, bytes]) -> None:
    for name in CURATED:
        path = DATA / name
        current = path.read_bytes() if path.exists() else None
        if before.get(name) != current:
            raise SystemExit(f"curated file changed during fetch: {name}")


def self_test() -> None:
    assert ny_trading_date(
        datetime(2026, 11, 20, 9, 30, tzinfo=NY).timestamp()
    ) == "2026-11-20"
    # 21:00 UTC is 16:00 in New York on the same trading date, already the next
    # calendar day in Singapore.
    assert ny_trading_date(
        datetime(2026, 11, 20, 21, 0, tzinfo=UTC).timestamp()
    ) == "2026-11-20"

    title, source = split_title(
        "SpaceX and Tesla talk merger - Reuters", "Reuters"
    )
    assert title == "SpaceX and Tesla talk merger"
    assert source == "Reuters"
    kept_title, kept_source = split_title("Tesla - SpaceX merger talks advance", "Bloomberg")
    assert kept_title == "Tesla - SpaceX merger talks advance"
    assert kept_source == "Bloomberg"

    now = datetime(2026, 11, 22, 6, 0, tzinfo=UTC)
    rss = """<?xml version="1.0"?>
    <rss version="2.0"><channel>
      <item>
        <title>Same story - Reuters</title>
        <link>https://news.google.com/rss/articles/one</link>
        <pubDate>Fri, 20 Nov 2026 15:00:00 GMT</pubDate>
        <source url="https://www.reuters.com">Reuters</source>
      </item>
      <item>
        <title>Same story - Reuters</title>
        <link>https://news.google.com/rss/articles/two</link>
        <pubDate>Fri, 20 Nov 2026 16:00:00 GMT</pubDate>
        <source url="https://www.reuters.com">Reuters</source>
      </item>
      <item>
        <title>另一条中文报道 - 路透</title>
        <link>https://news.google.com/rss/articles/zh</link>
        <pubDate>Thu, 12 Nov 2026 08:00:00 GMT</pubDate>
        <source url="https://www.reuters.com">路透</source>
      </item>
      <item>
        <title>Too old - BBC</title>
        <link>https://news.google.com/rss/articles/old</link>
        <pubDate>Mon, 01 Jun 2026 08:00:00 GMT</pubDate>
        <source url="https://www.bbc.com">BBC</source>
      </item>
    </channel></rss>
    """.encode()
    parsed = parse_rss(rss, "Tesla SpaceX merger", now)
    assert len(parsed) == 3
    deduped = dedupe_news(parsed)
    assert [item["title"] for item in deduped] == ["Same story", "另一条中文报道"]
    assert deduped[0]["url"].endswith("two")
    assert deduped[0]["published_at"].endswith("+08:00")

    yahoo = {
        "chart": {
            "result": [
                {
                    "meta": {
                        "symbol": "TSLA",
                        "currency": "USD",
                        "regularMarketPrice": 345.82000732421875,
                        "regularMarketTime": datetime(2026, 11, 20, 21, 0, 1, tzinfo=UTC).timestamp(),
                        "fullExchangeName": "NasdaqGS",
                        "regularMarketDayHigh": 373.88,
                        "regularMarketDayLow": 344.33,
                        "regularMarketVolume": 44510000,
                    },
                    "timestamp": [
                        datetime(2026, 8, 21, 9, 30, tzinfo=NY).timestamp() + i * 86400
                        for i in range(50)
                    ][:-1]
                    + [datetime(2026, 11, 19, 9, 30, tzinfo=NY).timestamp(),
                       datetime(2026, 11, 20, 9, 30, tzinfo=NY).timestamp()],
                    "indicators": {
                        "quote": [
                            {
                                "close": [100 + i for i in range(49)]
                                + [374.4100036621094, 345.82000732421875]
                            }
                        ]
                    },
                }
            ],
            "error": None,
        }
    }
    # The synthetic timestamps above are not a real calendar; rebuild cleanly.
    start = datetime(2026, 9, 1, 9, 30, tzinfo=NY)
    stamps = [(start + timedelta(days=i)).timestamp() for i in range(60)]
    stamps.append(datetime(2026, 11, 19, 9, 30, tzinfo=NY).timestamp())
    stamps.append(datetime(2026, 11, 20, 9, 30, tzinfo=NY).timestamp())
    closes = [200 + (i % 5) for i in range(60)] + [374.4100036621094, 345.82000732421875]
    yahoo["chart"]["result"][0]["timestamp"] = stamps
    yahoo["chart"]["result"][0]["indicators"]["quote"][0]["close"] = closes
    parsed_quote = parse_yahoo(yahoo, "2026-11-22T14:00:00+08:00")
    assert parsed_quote["price"] == 345.82
    assert parsed_quote["previous_close"] == 374.41
    assert parsed_quote["change"] == -28.59
    assert parsed_quote["change_percent"] == -7.64
    assert parsed_quote["trading_date"] == "2026-11-20"
    assert parsed_quote["history"][-1] == {"date": "2026-11-20", "close": 345.82}
    assert parsed_quote["day_high"] == 373.88
    assert parsed_quote["day_low"] == 344.33

    try:
        write_if_changed(DATA / "briefing.json", {}, news_material)
    except SystemExit as exc:
        assert "curated" in str(exc) or "refusing" in str(exc)
    else:
        raise AssertionError("curated write was allowed")
    print("self-test ok")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-test", action="store_true", help="run offline checks and exit")
    parser.add_argument("--dry-run", action="store_true", help="fetch and print a summary, do not write")
    args = parser.parse_args(argv)
    if args.self_test:
        self_test()
        return 0

    before = {name: (DATA / name).read_bytes() if (DATA / name).exists() else None for name in CURATED}
    now = now_sgt()
    news_status = "failed"
    tsla_status = "failed"
    failures: list[str] = []

    try:
        news = fetch_news(now)
    except (urllib.error.URLError, RuntimeError, ET.ParseError, TimeoutError) as exc:
        failures.append(f"news: {exc}")
        news = None
    else:
        print(f"news: {len(news['items'])} items")
        if news["items"]:
            print(f"  newest: {news['items'][0]['published_at']} {news['items'][0]['title'][:80]}")
        if args.dry_run:
            news_status = "dry-run"
        else:
            news_status = write_if_changed(NEWS_PATH, news, news_material)
        print(f"news.json {news_status}")

    try:
        quote = fetch_tsla(now)
    except (urllib.error.URLError, RuntimeError, TimeoutError, json.JSONDecodeError) as exc:
        failures.append(f"tsla: {exc}")
        quote = None
    else:
        print(
            f"tsla: {quote['price']} {quote['change']:+} ({quote['change_percent']:+}%) "
            f"session {quote['trading_date']} bars {len(quote['history'])}"
        )
        if args.dry_run:
            tsla_status = "dry-run"
        else:
            tsla_status = write_if_changed(TSLA_PATH, quote, tsla_material)
        print(f"tsla.json {tsla_status}")

    if not args.dry_run:
        assert_curated_untouched(before)

    for line in failures:
        print(line, file=sys.stderr)

    news_ok = news_status in {"updated", "unchanged", "dry-run"} or (
        NEWS_PATH.exists() and news is None
    )
    tsla_ok = tsla_status in {"updated", "unchanged", "dry-run"} or (
        TSLA_PATH.exists() and quote is None
    )
    # A failed refresh may keep the previous file. The run fails only when a
    # source produced nothing and there is no previous file to keep.
    if not news_ok or not tsla_ok:
        return 1
    if failures:
        print("kept previous file for the failed source", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
