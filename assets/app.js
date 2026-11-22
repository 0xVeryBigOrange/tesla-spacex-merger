(function () {
  "use strict";

  var LANG_KEY = "spcx-lang";
  var UI = {
    zh: {
      docTitle: "Tesla × SpaceX 合并追踪 · 大橙子",
      brandSub: "合并追踪",
      heroTitle: "Tesla × SpaceX 合并追踪",
      heroDek: "跟踪两家公司的合并探讨：哪些已经确认，哪些仍是传闻。",
      heroNote: "只整理公开信息，不构成投资建议。",
      navBrief: "今日简报",
      navTimeline: "最新进展",
      navMusk: "马斯克",
      navTsla: "TSLA",
      briefTitle: "今日简报",
      timelineTitle: "最新进展",
      timelineDek: "上面是人工整理的里程碑，并标明已确认或传闻。下面的新闻由定时任务从 Google News 抓取，标题保持来源语言。",
      newsTitle: "最新新闻",
      muskTitle: "马斯克在 X 上的发言",
      tslaTitle: "TSLA 影响",
      tslaDek: "价格和走势来自 Yahoo Finance 的日线，大约三个月。分析段落来自人工简报。",
      updated: "简报更新",
      newsUpdated: "新闻抓取",
      quoteUpdated: "行情抓取",
      confirmed: "已确认",
      rumor: "传闻",
      post: "原创",
      repost: "转发",
      reply: "回复",
      sourceLink: "来源",
      viewPost: "查看原帖",
      last: "最新价",
      dayChange: "较前收",
      prev: "前收",
      session: "交易日",
      high: "当日最高",
      low: "当日最低",
      volume: "成交量",
      exchange: "交易所",
      window: "图中区间",
      windowHigh: "区间最高",
      windowLow: "区间最低",
      windowChange: "区间涨跌",
      chartHint: "在图上移动可查看当日收盘",
      chartLabel: "TSLA 日收盘，{start} 至 {end}，最低 {low}，最高 {high}",
      chartEmpty: "走势数据不足。",
      analysisTitle: "对股价和期权的简报",
      analysisNote: "这段文字来自人工简报，自动任务不会改写。上方价格和走势来自行情抓取，更新更频繁；两边时点不同是正常的。",
      loading: "正在读取数据…",
      loadError: "这一栏没有读到数据。",
      emptyNews: "这次没有抓到新闻。",
      noTime: "简报时间未知"
    },
    en: {
      docTitle: "Tesla × SpaceX merger tracker",
      brandSub: "Merger tracker",
      heroTitle: "Tesla × SpaceX merger tracker",
      heroDek: "Following the talks between the two companies: what is confirmed, and what is still a rumor.",
      heroNote: "Public information only. Not investment advice.",
      navBrief: "Daily brief",
      navTimeline: "Timeline",
      navMusk: "Musk on X",
      navTsla: "TSLA",
      briefTitle: "Daily brief",
      timelineTitle: "Timeline",
      timelineDek: "The milestones above are curated by hand and marked confirmed or rumor. The headlines below are fetched on a schedule from Google News and kept in the source language.",
      newsTitle: "Latest headlines",
      muskTitle: "Musk on X",
      tslaTitle: "TSLA impact",
      tslaDek: "Price and chart are daily bars from Yahoo Finance, about three months. The analysis is the hand-written briefing.",
      updated: "Briefing updated",
      newsUpdated: "Headlines fetched",
      quoteUpdated: "Quote fetched",
      confirmed: "Confirmed",
      rumor: "Rumor",
      post: "Post",
      repost: "Repost",
      reply: "Reply",
      sourceLink: "Source",
      viewPost: "View post",
      last: "Last",
      dayChange: "Vs prior close",
      prev: "Prior close",
      session: "Session",
      high: "Day high",
      low: "Day low",
      volume: "Volume",
      exchange: "Exchange",
      window: "Chart window",
      windowHigh: "Window high",
      windowLow: "Window low",
      windowChange: "Window change",
      chartHint: "Move across the chart to read a daily close",
      chartLabel: "TSLA daily closes, {start} to {end}, low {low}, high {high}",
      chartEmpty: "Not enough prices to chart.",
      analysisTitle: "Briefing on the stock and the options",
      analysisNote: "This text is the hand-written briefing. The scheduled job does not rewrite it. The price and chart above come from the market feed and update on a different clock, so the two timestamps will not always match.",
      loading: "Loading data…",
      loadError: "This section did not load.",
      emptyNews: "No headlines were fetched.",
      noTime: "Briefing time unknown"
    }
  };

  var lang = localStorage.getItem(LANG_KEY) === "en" ? "en" : "zh";
  var data = {};
  var ready = false;

  function t(key) {
    return (UI[lang] && UI[lang][key]) || UI.zh[key] || key;
  }

  function tx(value) {
    if (value == null) return "";
    if (typeof value === "string") return value;
    return value[lang] || value.zh || value.en || "";
  }

  function h(tag, attrs) {
    var node = document.createElement(tag);
    var kids = Array.prototype.slice.call(arguments, 2);
    Object.keys(attrs || {}).forEach(function (key) {
      var value = attrs[key];
      if (value == null || value === false) return;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else node.setAttribute(key, value);
    });
    kids.forEach(function (kid) {
      if (kid == null || kid === false) return;
      node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    });
    return node;
  }

  function safeUrl(url) {
    return /^https:\/\/[^\s]+$/.test(url || "") ? url : "";
  }

  function link(url, label, className) {
    var href = safeUrl(url);
    if (!href) return h("span", { class: className, text: label });
    return h("a", {
      href: href,
      class: className || "",
      target: "_blank",
      rel: "noopener noreferrer",
      text: label
    });
  }

  function fmtStamp(iso) {
    if (!iso) return "";
    var date = new Date(iso);
    if (Number.isNaN(date.getTime())) return String(iso);
    var formatted = new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-GB", {
      timeZone: "Asia/Singapore",
      year: "numeric",
      month: lang === "zh" ? "long" : "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).format(date);
    return lang === "zh" ? formatted + "（新加坡）" : formatted + " SGT";
  }

  function fmtDay(ymd) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd || "")) return ymd || "";
    var parts = ymd.split("-").map(Number);
    var date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12));
    return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-GB", {
      timeZone: "UTC",
      year: "numeric",
      month: lang === "zh" ? "long" : "short",
      day: "numeric"
    }).format(date);
  }

  function usd(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  function shares(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "—";
    return new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "en-US").format(value);
  }

  function signedPct(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "—";
    return (value > 0 ? "+" : "") + value.toFixed(2) + "%";
  }

  function byDateDesc(list, field) {
    return list.map(function (item, index) {
      return { item: item, index: index };
    }).sort(function (a, b) {
      var left = a.item[field] || "";
      var right = b.item[field] || "";
      if (left === right) return a.index - b.index;
      return left < right ? 1 : -1;
    }).map(function (row) { return row.item; });
  }

  function applyChrome() {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    document.title = t("docTitle");
    document.querySelectorAll("[data-i18n]").forEach(function (node) {
      node.textContent = t(node.getAttribute("data-i18n"));
    });
    var zh = document.getElementById("lang-zh");
    var en = document.getElementById("lang-en");
    zh.setAttribute("aria-pressed", lang === "zh" ? "true" : "false");
    en.setAttribute("aria-pressed", lang === "en" ? "true" : "false");
    var brief = data.briefing;
    var stamp = document.getElementById("hero-updated");
    if (!ready) {
      stamp.textContent = t("loading");
    } else if (brief && !brief.__error && brief.updated_at) {
      stamp.textContent = t("updated") + " · " + fmtStamp(brief.updated_at);
    } else {
      stamp.textContent = t("noTime");
    }
  }

  function errorBlock() {
    return h("div", { class: "card error", text: t("loadError") });
  }

  function paragraphs(text) {
    return String(text || "").split(/\n{2,}/).filter(Boolean).map(function (part) {
      return h("p", { text: part });
    });
  }

  function renderBrief() {
    var host = document.getElementById("brief");
    var doc = data.briefing;
    if (!doc || doc.__error) {
      host.replaceChildren(sectionHead(t("briefTitle"), ""), errorBlock());
      return;
    }
    var points = h("ul", { class: "points" });
    (doc.points || []).forEach(function (point) {
      points.append(h("li", { text: tx(point) }));
    });
    var body = h("div", { class: "card" },
      h("h3", { class: "headline", text: tx(doc.headline) }),
      h("div", { class: "prose" }, h("p", { text: tx(doc.summary) })),
      points
    );
    host.replaceChildren(sectionHead(t("briefTitle"), ""), body);
  }

  function sectionHead(title, dek) {
    return h("div", { class: "section-head" },
      h("h2", { text: title }),
      dek ? h("p", { text: dek }) : null
    );
  }

  function renderTimeline() {
    var host = document.getElementById("timeline");
    var doc = data.timeline;
    var news = data.news;
    var blocks = [sectionHead(t("timelineTitle"), t("timelineDek"))];
    if (!doc || doc.__error) {
      blocks.push(errorBlock());
    } else {
      byDateDesc(doc.items || [], "date").forEach(function (item) {
        var status = item.status === "rumor" ? "rumor" : "confirmed";
        blocks.push(h("article", { class: "card event" },
          h("div", { class: "event-top" },
            h("time", { datetime: item.date || "", text: fmtDay(item.date) }),
            h("span", { class: "badge " + status, text: t(status) })
          ),
          h("h3", {}, link(item.url, tx(item.title))),
          h("p", { class: "summary", text: tx(item.summary) }),
          h("p", { class: "meta" },
            item.source ? h("span", { text: item.source }) : null,
            link(item.url, t("sourceLink"))
          )
        ));
      });
    }
    blocks.push(h("h3", { class: "subhead", text: t("newsTitle") }));
    if (!news || news.__error) {
      blocks.push(errorBlock());
    } else {
      if (news.fetched_at) {
        blocks.push(h("p", { class: "fine", text: t("newsUpdated") + " · " + fmtStamp(news.fetched_at) }));
      }
      var items = byDateDesc(news.items || [], "published_at");
      if (!items.length) blocks.push(h("p", { class: "fine", text: t("emptyNews") }));
      items.forEach(function (item) {
        var bits = [item.source, fmtStamp(item.published_at), item.query].filter(Boolean);
        blocks.push(h("article", { class: "card news" },
          link(item.url, item.title || "", "news-title"),
          h("p", { class: "meta", text: bits.join(" · ") })
        ));
      });
    }
    host.replaceChildren.apply(host, blocks);
  }

  function renderMusk() {
    var host = document.getElementById("musk");
    var doc = data.musk;
    if (!doc || doc.__error) {
      host.replaceChildren(sectionHead(t("muskTitle"), ""), errorBlock());
      return;
    }
    var blocks = [sectionHead(t("muskTitle"), tx(doc.intro))];
    byDateDesc(doc.posts || [], "date").forEach(function (post) {
      var kind = post.kind === "repost" || post.kind === "reply" ? post.kind : "post";
      blocks.push(h("article", { class: "card post" },
        h("div", { class: "post-top" },
          h("span", { class: "badge kind", text: t(kind) }),
          h("time", { datetime: post.date || "", title: post.date || "", text: fmtStamp(post.date) }),
          link(post.url, t("viewPost"))
        ),
        h("p", { class: "post-text", text: tx(post.text) }),
        tx(post.note) ? h("p", { class: "note", text: tx(post.note) }) : null
      ));
    });
    host.replaceChildren.apply(host, blocks);
  }

  function stat(label, value) {
    return h("div", { class: "stat" }, h("span", { text: label }), h("b", { text: value }));
  }

  function renderChart(host, history) {
    host.replaceChildren();
    if (!history || history.length < 2) {
      host.append(h("p", { class: "fine", text: t("chartEmpty") }));
      return;
    }
    var width = 640;
    var height = 220;
    var pad = { l: 12, r: 12, t: 18, b: 28 };
    var closes = history.map(function (bar) { return bar.close; });
    var min = Math.min.apply(null, closes);
    var max = Math.max.apply(null, closes);
    if (min === max) { min -= 1; max += 1; }
    var span = max - min;
    var innerW = width - pad.l - pad.r;
    var innerH = height - pad.t - pad.b;
    var points = history.map(function (bar, index) {
      var x = pad.l + (index / (history.length - 1)) * innerW;
      var y = pad.t + (1 - (bar.close - min) / span) * innerH;
      return { x: x, y: y, bar: bar };
    });
    var ns = "http://www.w3.org/2000/svg";
    function svg(name, attrs) {
      var node = document.createElementNS(ns, name);
      Object.keys(attrs || {}).forEach(function (key) {
        node.setAttribute(key, attrs[key]);
      });
      return node;
    }
    var root = svg("svg", {
      viewBox: "0 0 " + width + " " + height,
      role: "img",
      "aria-label": t("chartLabel")
        .replace("{start}", history[0].date)
        .replace("{end}", history[history.length - 1].date)
        .replace("{low}", min.toFixed(2))
        .replace("{high}", max.toFixed(2))
    });
    root.setAttribute("class", "chart");
    var defs = svg("defs");
    var grad = svg("linearGradient", { id: "tsla-area", x1: "0", y1: "0", x2: "0", y2: "1" });
    grad.append(svg("stop", { offset: "0%", "stop-color": "#ff7a1a", "stop-opacity": "0.38" }));
    grad.append(svg("stop", { offset: "100%", "stop-color": "#ff7a1a", "stop-opacity": "0" }));
    defs.append(grad);
    root.append(defs);
    [min, (min + max) / 2, max].forEach(function (value) {
      var y = pad.t + (1 - (value - min) / span) * innerH;
      root.append(svg("line", {
        x1: pad.l, x2: width - pad.r, y1: y, y2: y, class: "grid"
      }));
      var label = svg("text", { x: width - pad.r, y: y - 4, class: "axis", "text-anchor": "end" });
      label.textContent = value.toFixed(0);
      root.append(label);
    });
    var coords = points.map(function (point) {
      return point.x.toFixed(1) + "," + point.y.toFixed(1);
    }).join(" ");
    var base = (pad.t + innerH).toFixed(1);
    root.append(svg("polygon", {
      points: pad.l + "," + base + " " + coords + " " + (width - pad.r) + "," + base,
      fill: "url(#tsla-area)"
    }));
    root.append(svg("polyline", { points: coords, class: "price-line" }));
    var end = points[points.length - 1];
    root.append(svg("circle", { cx: end.x, cy: end.y, r: 4.5, class: "price-dot" }));
    var startLabel = svg("text", { x: pad.l, y: height - 8, class: "axis" });
    startLabel.textContent = history[0].date;
    var endLabel = svg("text", { x: width - pad.r, y: height - 8, class: "axis", "text-anchor": "end" });
    endLabel.textContent = history[history.length - 1].date;
    root.append(startLabel, endLabel);
    var hover = svg("line", {
      class: "hover", y1: pad.t, y2: pad.t + innerH, visibility: "hidden"
    });
    root.append(hover);
    var readout = h("p", { class: "readout", text: t("chartHint") });
    function nearest(clientX) {
      var rect = root.getBoundingClientRect();
      if (!rect.width) return;
      var x = ((clientX - rect.left) / rect.width) * width;
      var best = points[0];
      var dist = Infinity;
      points.forEach(function (point) {
        var gap = Math.abs(point.x - x);
        if (gap < dist) { dist = gap; best = point; }
      });
      hover.setAttribute("x1", best.x);
      hover.setAttribute("x2", best.x);
      hover.setAttribute("visibility", "visible");
      readout.textContent = best.bar.date + "  " + usd(best.bar.close);
    }
    root.addEventListener("pointermove", function (event) { nearest(event.clientX); });
    root.addEventListener("pointerleave", function () {
      hover.setAttribute("visibility", "hidden");
      readout.textContent = t("chartHint");
    });
    host.append(root, readout);
  }

  function renderTsla() {
    var host = document.getElementById("tsla");
    var quote = data.tsla;
    var brief = data.briefing;
    var blocks = [sectionHead(t("tslaTitle"), t("tslaDek"))];
    if (!quote || quote.__error) {
      blocks.push(errorBlock());
    } else {
      var direction = quote.change > 0 ? "up" : quote.change < 0 ? "down" : "flat";
      var change = (quote.change > 0 ? "+" : "") + Number(quote.change).toFixed(2)
        + " (" + signedPct(quote.change_percent) + ")";
      var history = quote.history || [];
      var windowPct = null;
      var windowHigh = null;
      var windowLow = null;
      if (history.length) {
        windowHigh = Math.max.apply(null, history.map(function (bar) { return bar.close; }));
        windowLow = Math.min.apply(null, history.map(function (bar) { return bar.close; }));
      }
      if (history.length >= 2 && history[0].close) {
        windowPct = (history[history.length - 1].close - history[0].close) / history[0].close * 100;
      }
      var card = h("div", { class: "card" },
        h("div", { class: "quote-row" },
          h("div", {},
            h("p", { class: "price", text: usd(quote.price) }),
            h("p", { class: "change " + direction, text: change })
          ),
          h("p", { class: "fine", text: t("quoteUpdated") + " · " + fmtStamp(quote.fetched_at) })
        ),
        h("div", { class: "stats" },
          stat(t("prev"), usd(quote.previous_close)),
          stat(t("session"), fmtDay(quote.trading_date)),
          quote.day_high != null ? stat(t("high"), usd(quote.day_high)) : null,
          quote.day_low != null ? stat(t("low"), usd(quote.day_low)) : null,
          quote.volume != null ? stat(t("volume"), shares(quote.volume)) : null,
          quote.exchange ? stat(t("exchange"), quote.exchange) : null,
          history.length ? stat(t("window"), history[0].date + " → " + history[history.length - 1].date) : null,
          windowHigh != null ? stat(t("windowHigh"), usd(windowHigh)) : null,
          windowLow != null ? stat(t("windowLow"), usd(windowLow)) : null,
          windowPct != null ? stat(t("windowChange"), signedPct(windowPct)) : null
        )
      );
      var chartHost = h("div", { class: "chart-wrap" });
      card.append(chartHost);
      blocks.push(card);
      renderChart(chartHost, history);
    }
    if (brief && !brief.__error && tx(brief.tsla_analysis)) {
      var analysis = h("div", { class: "card analysis" },
        h("h3", { text: t("analysisTitle") }),
        h("p", { class: "note", text: t("analysisNote") })
      );
      var prose = h("div", { class: "prose" });
      paragraphs(tx(brief.tsla_analysis)).forEach(function (p) { prose.append(p); });
      analysis.append(prose);
      blocks.push(analysis);
    }
    host.replaceChildren.apply(host, blocks);
  }

  function render() {
    applyChrome();
    if (!ready) {
      ["brief", "timeline", "musk", "tsla"].forEach(function (id) {
        document.getElementById(id).replaceChildren(h("p", { class: "fine", text: t("loading") }));
      });
      return;
    }
    renderBrief();
    renderTimeline();
    renderMusk();
    renderTsla();
  }

  function setLang(next) {
    lang = next === "en" ? "en" : "zh";
    try { localStorage.setItem(LANG_KEY, lang); } catch (err) { /* private mode */ }
    render();
  }

  document.getElementById("lang-zh").addEventListener("click", function () { setLang("zh"); });
  document.getElementById("lang-en").addEventListener("click", function () { setLang("en"); });

  var files = {
    briefing: "data/briefing.json",
    timeline: "data/timeline.json",
    news: "data/news.json",
    musk: "data/musk_posts.json",
    tsla: "data/tsla.json"
  };

  Promise.all(Object.keys(files).map(function (name) {
    return fetch(files[name], { cache: "no-cache" }).then(function (res) {
      if (!res.ok) throw new Error(String(res.status));
      return res.json().then(function (json) { return [name, json]; });
    }).catch(function () {
      return [name, { __error: true }];
    });
  })).then(function (rows) {
    rows.forEach(function (row) { data[row[0]] = row[1]; });
    ready = true;
    render();
  });

  render();
})();
