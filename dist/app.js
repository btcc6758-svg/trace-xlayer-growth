const API = (page) =>
  `https://api.geckoterminal.com/api/v2/networks/x-layer/new_pools?page=${page}`;
const el = (id) => document.getElementById(id);
let pools = [],
  selected = null,
  lastLoad = null,
  nextPage = 2,
  loadingMore = false;
const fmt = (n) =>
  Number.isFinite(n)
    ? new Intl.NumberFormat("en-US", {
        notation: n >= 1e6 ? "compact" : "standard",
        maximumFractionDigits: n < 100 ? 2 : 0,
      }).format(n)
    : "—";
const usd = (n) => (Number.isFinite(n) ? "$" + fmt(n) : "—");
const short = (a) =>
  a && a.length > 16 ? a.slice(0, 8) + "…" + a.slice(-6) : a || "—";
const num = (v) =>
  v === null || v === undefined || v === ""
    ? null
    : Number.isFinite(Number(v))
      ? Number(v)
      : null;
function readPool(p, sourcePage) {
  const a = p.attributes || {},
    r = p.relationships || {};
  return {
    id: p.id,
    address: a.address,
    name: a.name || "未命名池",
    created: a.pool_created_at,
    liquidity: num(a.reserve_in_usd),
    volume: num(a.volume_usd?.h24),
    buys: num(a.transactions?.h24?.buys),
    sells: num(a.transactions?.h24?.sells),
    dex: r.dex?.data?.id || "未知 DEX",
    base: r.base_token?.data?.id?.replace(/^x-layer_/, "") || null,
    quote: r.quote_token?.data?.id?.replace(/^x-layer_/, "") || null,
    sourcePage,
    observedAt: new Date().toISOString(),
  };
}
function assess(p) {
  const age = (Date.now() - Date.parse(p.created)) / 3600000;
  const valid =
    p.liquidity !== null &&
    p.liquidity >= 0 &&
    p.buys !== null &&
    p.buys >= 0 &&
    p.sells !== null &&
    p.sells >= 0 &&
    Number.isFinite(age) &&
    age >= 0;
  const depth = valid && p.liquidity >= 10000;
  const fresh = valid && age < 24;
  const activity = valid && p.buys + p.sells >= 20;
  const bits = [Number(valid), Number(depth), Number(fresh), Number(activity)];
  const output = TraceCircuit.evaluate(bits);
  const label = TraceCircuit.classify(bits);
  const cls = !valid
    ? "unknown"
    : output.showcase
      ? "showcase"
      : output.discover
        ? "discover"
        : "building";
  const reasons = [];
  if (!valid)
    reasons.push("部分公开字段尚未齐备；项目继续展示，等待数据源更新。");
  else {
    reasons.push(
      fresh
        ? "新上线：池创建不足 24 小时，进入新项目发现入口。"
        : "池已运行超过 24 小时，可继续积累公开进展。",
    );
    reasons.push(
      depth
        ? "基础流动性里程碑：索引器估算储备达到 $10,000。"
        : "基础流动性里程碑尚在积累；仍保留在完整列表。",
    );
    reasons.push(
      activity
        ? "公开活动里程碑：近 24 小时买卖合计达到 20 笔。"
        : "近 24 小时交易笔数尚未达到 20 笔；不影响展示。",
    );
  }
  return { label, cls, reasons, bits, output, age };
}
function statusNode(a) {
  const s = document.createElement("span");
  s.className = "status " + a.cls;
  s.textContent = a.label;
  return s;
}
function renderList() {
  const q = el("query").value.trim().toLowerCase();
  const visible = pools.filter(
    (p) =>
      !q ||
      [p.name, p.address, p.base, p.quote].some((x) =>
        x?.toLowerCase().includes(q),
      ),
  );
  el("count").textContent = `${visible.length}/${pools.length}`;
  const box = el("candidates");
  box.replaceChildren();
  if (!visible.length) {
    const d = document.createElement("div");
    d.className = "empty";
    d.textContent = pools.length
      ? "没有匹配的候选。"
      : "当前没有可展示的候选；请稍后刷新。";
    box.append(d);
    return;
  }
  for (const p of visible) {
    const b = document.createElement("button");
    b.className = "candidate" + (p.id === selected ? " active" : "");
    b.type = "button";
    const c = document.createElement("div");
    const name = document.createElement("span");
    name.className = "coin-name";
    name.textContent = p.name;
    const sub = document.createElement("span");
    sub.className = "coin-sub";
    sub.textContent = p.dex + " · " + short(p.base);
    c.append(name, sub);
    const m = document.createElement("span");
    m.className = "money";
    m.textContent = usd(p.liquidity);
    b.append(c, m, statusNode(assess(p)));
    b.addEventListener("click", () => {
      selected = p.id;
      renderList();
      renderDetail();
    });
    box.append(b);
  }
}
function renderDetail() {
  const p = pools.find((x) => x.id === selected);
  if (!p) return;
  const a = assess(p),
    age = a.age;
  el("detail-name").textContent = p.name;
  const badge = el("detail-status");
  badge.className = "status " + a.cls;
  badge.textContent = a.label;
  el("detail-intro").textContent =
    `${p.dex} · 池地址 ${p.address} · ${p.created ? new Date(p.created).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }) : "创建时间未知"}（北京时间）`;
  const metrics = [
    ["估算流动性", usd(p.liquidity)],
    ["24 小时成交额", usd(p.volume)],
    [
      "池龄",
      Number.isFinite(age) && age >= 0
        ? age < 24
          ? fmt(age) + " 小时"
          : fmt(age / 24) + " 天"
        : "—",
    ],
    [
      "24 小时买 / 卖",
      p.buys === null || p.sells === null ? "—" : `${p.buys} / ${p.sells}`,
    ],
  ];
  const box = el("metrics");
  box.replaceChildren();
  for (const [label, value] of metrics) {
    const d = document.createElement("div");
    d.className = "metric";
    const s = document.createElement("span");
    s.textContent = label;
    const strong = document.createElement("strong");
    strong.textContent = value;
    d.append(s, strong);
    box.append(d);
  }
  const progress = el("progress");
  progress.replaceChildren();
  const h = document.createElement("h3");
  h.textContent = "公开进展";
  const ul = document.createElement("ul");
  for (const reason of a.reasons) {
    const li = document.createElement("li");
    li.textContent = reason;
    ul.append(li);
  }
  progress.append(h, ul);
  renderCircuit(a);
  const links = el("links");
  links.replaceChildren();
  const gt = document.createElement("a");
  gt.href = `https://www.geckoterminal.com/x-layer/pools/${encodeURIComponent(p.address)}`;
  gt.target = "_blank";
  gt.rel = "noopener noreferrer";
  gt.textContent = "查看池子数据 ↗";
  links.append(gt);
  if (p.base?.startsWith("0x") && p.base.length === 42) {
    const token = document.createElement("a");
    token.href = `https://www.oklink.com/xlayer/address/${p.base}`;
    token.target = "_blank";
    token.rel = "noopener noreferrer";
    token.textContent = "查看代币合约 ↗";
    links.append(token);
  }
  const spec = document.createElement("a");
  spec.href = "./netlist.json";
  spec.target = "_blank";
  spec.rel = "noopener noreferrer";
  spec.textContent = "查看电路定义 ↗";
  links.append(spec);
  const evidence = document.createElement("button");
  evidence.type = "button";
  evidence.textContent = "下载进展快照 ↓";
  evidence.addEventListener("click", () => {
    downloadEvidence(p.id).catch((error) => {
      el("page-status").textContent = `快照导出失败：${error.message}`;
    });
  });
  links.append(evidence);
  if (TraceChain.deployment.processor) {
    const chain = document.createElement("a");
    chain.href = `https://www.oklink.com/xlayer/address/${TraceChain.deployment.processor}`;
    chain.target = "_blank";
    chain.rel = "noopener noreferrer";
    chain.textContent = "查看处理器合约 ↗";
    links.append(chain);
  }
}
async function downloadEvidence(id) {
  const p = pools.find((x) => x.id === id);
  if (!p) throw new Error("候选已不在当前列表");
  const a = assess(p);
  const netlist = TraceCircuit.encode();
  const bytes = Uint8Array.from(netlist.slice(2).match(/../g), (hex) =>
    parseInt(hex, 16),
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const netlistSha256 =
    "0x" +
    Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  const evidence = {
    schema: "trace-ecosystem-snapshot-v1",
    evaluatedAt: new Date().toISOString(),
    source: {
      name: "GeckoTerminal X Layer new pools",
      url: API(p.sourcePage),
      observedAt: p.observedAt,
      page: p.sourcePage,
    },
    pool: p,
    policy: {
      depthMilestoneUsd: 10000,
      freshPoolHours: 24,
      activityMilestoneTransactions24h: 20,
      inputOrder: TraceCircuit.inputs,
      outputOrder: TraceCircuit.outputs,
    },
    result: {
      label: a.label,
      reasons: a.reasons,
      inputBits: a.bits,
      outputBits: [a.output.discover, a.output.showcase],
      gateTrace: a.output.trace,
    },
    circuit: {
      nIn: TraceCircuit.nIn,
      nOut: TraceCircuit.nOut,
      nandCount: TraceCircuit.gates.length,
      netlistSha256,
      netlist,
      processor: TraceChain.deployment.processor,
      circuitId: TraceChain.deployment.circuitId,
    },
    limitations:
      "Indexer fields are mutable estimates. The activity bit does not prove unique users or organic trading. Milestone labels are discovery aids, not an endorsement, reward eligibility, investment advice, or independently verified market facts.",
  };
  const blob = new Blob([JSON.stringify(evidence, null, 2) + "\n"], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `trace-${(p.address || id).replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function renderCircuit(a) {
  const labels = [
    "公开字段齐备",
    "估算储备 ≥ $10K",
    "池创建 < 24h",
    "24h 买卖合计 ≥ 20",
  ];
  const inputs = el("circuit-inputs");
  inputs.replaceChildren();
  a.bits.forEach((bit, i) => {
    const d = document.createElement("div");
    d.className = "bit";
    const name = document.createElement("span");
    name.textContent = labels[i];
    const value = document.createElement("strong");
    value.textContent = String(bit);
    d.append(name, value);
    inputs.append(d);
  });
  el("circuit-output").textContent =
    `输出：发现入口 ${a.output.discover} · 进展展示 ${a.output.showcase} → ${a.label}。公开字段位为 0 时，标签固定为“资料待补”。`;
  const trace = el("gate-trace");
  trace.replaceChildren();
  for (const row of a.output.trace) {
    const d = document.createElement("div");
    d.className = "gate-row";
    d.textContent = `#${row.gate} = NAND(#${row.a}:${row.inA}, #${row.b}:${row.inB}) → ${row.out}`;
    trace.append(d);
  }
  const result = el("chain-result");
  if (!TraceChain.deployment.processor) {
    el("circuit-mode").textContent = "本地试算 · 待流片";
    result.className = "chain-result";
    result.textContent = "主网电路尚未部署；当前仅展示门级试算。";
    return;
  }
  el("circuit-mode").textContent = "X Layer 主网核验";
  result.className = "chain-result";
  result.textContent = "正在向 X Layer 节点只读查询电路输出…";
  const id = selected;
  TraceChain.evaluate(a.bits)
    .then((chain) => {
      if (selected !== id) return;
      const match =
        chain &&
        chain.discover === a.output.discover &&
        chain.showcase === a.output.showcase;
      result.className = "chain-result " + (match ? "verified" : "error");
      result.textContent = match
        ? `主网输出 ${chain.raw} 与门级试算一致。`
        : `主网输出 ${chain?.raw || "无"} 与本地不一致，当前里程碑标签不可采信。`;
    })
    .catch((error) => {
      if (selected !== id) return;
      result.className = "chain-result error";
      result.textContent = `主网查询失败：${error.message}；保留本地试算并标记未核验。`;
    });
}
async function load() {
  el("source-title").textContent = "正在读取 X Layer 新池";
  el("source-detail").textContent = "连接 GeckoTerminal 公共 API…";
  el("source-dot").style.background = "#e9b55f";
  try {
    const res = await fetch(API(1), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    if (!Array.isArray(json.data)) throw new Error("响应缺少 data");
    pools = json.data.map((p) => readPool(p, 1));
    nextPage = 2;
    el("more").disabled = pools.length === 0;
    el("page-status").textContent = "当前已加载第 1 页";
    lastLoad = new Date();
    el("source-title").textContent = `已加载 ${pools.length} 个最新池`;
    el("source-detail").textContent =
      `GeckoTerminal · ${lastLoad.toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai" })} 北京时间 · 已加载第 1 页`;
    el("source-dot").style.background = "#3be1ad";
    if (!pools.some((p) => p.id === selected)) selected = pools[0]?.id || null;
    renderList();
    renderDetail();
  } catch (e) {
    el("source-title").textContent = "数据源暂不可用";
    el("source-detail").textContent =
      `${e.message} · 已保留现有数据；不能据此判断没有候选`;
    el("source-dot").style.background = "#ed9b76";
    renderList();
  }
}
async function loadMore() {
  if (loadingMore) return;
  loadingMore = true;
  el("more").disabled = true;
  el("more").textContent = "加载中…";
  try {
    const response = await fetch(API(nextPage), {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const json = await response.json();
    if (!Array.isArray(json.data)) throw new Error("响应缺少 data");
    const existing = new Set(pools.map((p) => p.id));
    const additions = json.data
      .map((p) => readPool(p, nextPage))
      .filter((p) => !existing.has(p.id));
    pools.push(...additions);
    if (json.data.length === 0) {
      el("page-status").textContent = "数据源没有返回更多候选";
      el("more").textContent = "已到末页";
      return;
    }
    nextPage++;
    el("page-status").textContent = `已加载前 ${nextPage - 1} 页`;
    el("source-title").textContent = `已加载 ${pools.length} 个最新池`;
    renderList();
    el("more").disabled = false;
    el("more").textContent = "加载更多候选";
  } catch (error) {
    el("page-status").textContent =
      `第 ${nextPage} 页失败：${error.message}；已保留现有候选`;
    el("more").disabled = false;
    el("more").textContent = "重试加载";
  } finally {
    loadingMore = false;
  }
}
el("refresh").addEventListener("click", load);
el("more").addEventListener("click", loadMore);
el("query").addEventListener("input", renderList);
load();
if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  const register = (tool) =>
    Promise.resolve(
      document.modelContext.registerTool(tool, { signal: lifecycle.signal }),
    ).catch(() => {});
  register({
    name: "list_loaded_candidates",
    title: "列出已加载候选",
    description: "读取当前页面已加载的 X Layer 新池及公开进展状态。",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: () =>
      pools.map((p) => ({
        id: p.id,
        name: p.name,
        pool: p.address,
        status: assess(p).label,
      })),
  });
  register({
    name: "select_candidate",
    title: "选择候选",
    description: "在成长地图选择一个已加载池，显示其公开数据和电路输出。",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute: (input) => {
      if (!input || typeof input.id !== "string")
        throw new Error("id must be a string");
      const p = pools.find((x) => x.id === input.id);
      if (!p) throw new Error("candidate not loaded");
      selected = p.id;
      renderList();
      renderDetail();
      return { id: p.id, name: p.name, status: assess(p).label };
    },
  });
}
