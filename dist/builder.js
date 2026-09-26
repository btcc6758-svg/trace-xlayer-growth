(function () {
  const el = (id) => document.getElementById(id);
  const form = el("builder-form");
  const card = el("builder-card");
  const feedback = el("builder-feedback");
  const toggle = el("builder-toggle");
  function publicUrl(value, kind) {
    if (!value) return null;
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error(`${kind}链接格式错误`);
    }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password)
      throw new Error(`${kind}只接受 HTTPS 公开链接`);
    if (kind === "GitHub") {
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (
        !["github.com", "www.github.com"].includes(parsed.hostname) ||
        parts.length < 2
      )
        throw new Error("GitHub 请填写公开仓库地址");
    }
    return parsed.href;
  }
  function normalize(input) {
    const profile = {
      name: String(input.name || "")
        .trim()
        .slice(0, 80),
      contract: String(input.contract || "")
        .trim()
        .toLowerCase(),
      processor: String(input.processor || "")
        .trim()
        .toLowerCase(),
      github: publicUrl(String(input.github || "").trim(), "GitHub"),
      demo: publicUrl(String(input.demo || "").trim(), "演示"),
    };
    if (!profile.name) throw new Error("请填写项目名称");
    if (!BuilderChain.isAddress(profile.contract))
      throw new Error("请填写有效的 X Layer 合约地址");
    if (profile.processor && !BuilderChain.isAddress(profile.processor))
      throw new Error("Processor 地址格式错误");
    return profile;
  }
  function profileUrl(profile) {
    const url = new URL(location.origin + location.pathname);
    for (const [key, value] of Object.entries(profile))
      if (value) url.searchParams.set(key, value);
    return url.href;
  }
  function readSharedProfile() {
    const params = new URLSearchParams(location.search);
    if (!params.has("contract")) return null;
    return normalize(Object.fromEntries(params));
  }
  function fillForm(profile) {
    for (const key of ["name", "contract", "processor", "github", "demo"])
      el("builder-" + key).value = profile[key] || "";
  }
  function node(tag, className, value) {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (value !== undefined) item.textContent = value;
    return item;
  }
  function external(label, href) {
    const link = node("a", "builder-link", label + " ↗");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return link;
  }
  function milestone(label, description, state) {
    const item = node("div", "builder-milestone " + state);
    item.append(node("strong", "", label), node("span", "", description));
    return item;
  }
  async function checkGithub(href) {
    if (!href) return { status: "not_provided" };
    const url = new URL(href);
    const [owner, name] = url.pathname.split("/").filter(Boolean);
    const repo = name.replace(/\.git$/i, "");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
        {
          headers: { Accept: "application/vnd.github+json" },
          signal: controller.signal,
        },
      );
      if (response.status === 404) return { status: "not_public" };
      if (
        response.status === 429 ||
        (response.status === 403 &&
          response.headers.get("X-RateLimit-Remaining") === "0")
      )
        return { status: "rate_limited" };
      if (!response.ok) throw new Error("GitHub HTTP " + response.status);
      const data = await response.json();
      if (data.private || !data.html_url) return { status: "not_public" };
      return { status: "public", fullName: data.full_name };
    } catch (error) {
      return { status: "unavailable", error: error.message };
    } finally {
      clearTimeout(timeout);
    }
  }
  function render(profile, chain, github) {
    card.replaceChildren();
    const head = node("div", "builder-card-head");
    const heading = node("div", "");
    heading.append(
      node("span", "eyebrow", "PROJECT / SHAREABLE CARD"),
      node("h3", "", profile.name),
      node(
        "p",
        "",
        "项目名称与外部链接由填写者提供；链上状态在打开时重新查询。",
      ),
    );
    head.append(heading, node("span", "builder-network", "X Layer · 196"));
    card.append(head);
    const grid = node("div", "builder-milestones");
    if (!chain) {
      grid.append(
        milestone(
          "链上来源暂不可用",
          "无法据此判断合约或 Processor 不存在。",
          "pending",
        ),
      );
    } else {
      const code = chain.contract.status;
      grid.append(
        milestone(
          code === "code_present"
            ? "合约代码已读取"
            : code === "no_code"
              ? "未读取到合约代码"
              : "合约代码暂无法核对",
          "只证明该地址在 X Layer 上是否返回代码，不代表合约安全。",
          code === "code_present" ? "success" : "pending",
        ),
      );
      const cpu = chain.processor.status;
      grid.append(
        milestone(
          cpu === "registered"
            ? "TapeOut 工厂已登记"
            : cpu === "not_provided"
              ? "未提供 Processor"
              : cpu === "not_registered"
                ? "工厂未登记此地址"
                : "Processor 暂无法核对",
          cpu === "registered"
            ? "此地址由 X Layer TapeOut 工厂识别为 Processor。"
            : "公开展示卡仍可分享；不会标成已核验 Processor。",
          cpu === "registered" ? "success" : "pending",
        ),
      );
      if (cpu === "registered") {
        const count = chain.processor.circuitCount;
        grid.append(
          milestone(
            count === null ? "流片数量暂无法核对" : `已流片 ${count} 个电路`,
            "数量来自 Processor 的 nextId() 只读调用。",
            count !== null && BigInt(count) > 0n ? "success" : "pending",
          ),
        );
      }
    }
    grid.append(
      milestone(
        github.status === "public"
          ? "公开仓库可访问"
          : github.status === "not_provided"
            ? "未提供 GitHub"
            : github.status === "not_public"
              ? "未找到公开仓库"
              : github.status === "rate_limited"
                ? "GitHub 接口限流"
                : "GitHub 暂无法核对",
        github.status === "public"
          ? github.fullName
          : github.status === "rate_limited"
            ? "公开状态暂无法判定，请稍后重新打开分享链接。"
            : "仓库链接由填写者提供；不能证明合约归属。",
        github.status === "public" ? "success" : "pending",
      ),
    );
    card.append(grid);
    const links = node("div", "builder-links");
    links.append(
      external(
        "X Layer 合约",
        `https://www.oklink.com/xlayer/address/${profile.contract}`,
      ),
    );
    if (profile.processor)
      links.append(
        external(
          "TapeOut Processor",
          `https://www.oklink.com/xlayer/address/${profile.processor}`,
        ),
      );
    if (profile.github) links.append(external("项目方 GitHub", profile.github));
    if (profile.demo) links.append(external("项目方演示", profile.demo));
    card.append(links);
    const share = node("div", "builder-share");
    const shareLabel = node("label", "", "分享此展示卡");
    const field = node("input", "");
    field.type = "text";
    field.readOnly = true;
    field.value = profileUrl(profile);
    field.setAttribute("aria-label", "可分享的展示卡链接");
    shareLabel.append(field);
    const copy = node("button", "", "复制链接");
    copy.type = "button";
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(field.value);
        copy.textContent = "已复制";
      } catch {
        field.focus();
        field.select();
        copy.textContent = "请手动复制";
      }
    });
    share.append(shareLabel, copy);
    card.append(share);
    card.append(
      node(
        "p",
        "builder-disclosure",
        `核对时间：${new Date(chain?.checkedAt || Date.now()).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}（北京时间）。项目名称、演示链接及两个合约地址之间的归属关系未核验；此卡不是官方背书或投资建议。`,
      ),
    );
    card.hidden = false;
  }
  async function build(profile) {
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    feedback.textContent = "正在读取 X Layer 合约与公开仓库…";
    const [chainResult, githubResult] = await Promise.allSettled([
      BuilderChain.verify(profile.contract, profile.processor),
      checkGithub(profile.github),
    ]);
    const chain = chainResult.status === "fulfilled" ? chainResult.value : null;
    const github =
      githubResult.status === "fulfilled"
        ? githubResult.value
        : { status: "unavailable" };
    render(profile, chain, github);
    feedback.textContent = chain
      ? "展示卡已生成；链上状态会在分享链接打开时重新核对。"
      : `展示卡已生成；${chainResult.reason?.message || "链上状态暂不可用"}`;
    button.disabled = false;
  }
  toggle.addEventListener("click", () => {
    form.hidden = !form.hidden;
    toggle.setAttribute("aria-expanded", String(!form.hidden));
    toggle.textContent = form.hidden ? "创建展示卡" : "收起填写区";
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const profile = normalize(Object.fromEntries(new FormData(form)));
      history.replaceState(null, "", profileUrl(profile));
      build(profile).catch((error) => {
        feedback.textContent = `展示卡生成失败：${error.message}`;
      });
    } catch (error) {
      feedback.textContent = error.message;
    }
  });
  try {
    const shared = readSharedProfile();
    if (shared) {
      fillForm(shared);
      build(shared);
    }
  } catch (error) {
    feedback.textContent = `分享链接参数无效：${error.message}`;
  }
})();
