(function () {
  const el = (id) => document.getElementById(id);
  let proof = null;
  let requestNumber = 0;
  const inputIds = ["vault-window", "vault-unused", "vault-budget"];
  const output = (id, value) => { el(id).textContent = value; };

  function drawTable(activeBits) {
    const table = el("vault-truth-table");
    table.replaceChildren();
    const head = document.createElement("thead");
    const labels = ["电路归属", "窗口开放", "未领取", "预算足够", "可领取", "待补预算"];
    const headerRow = document.createElement("tr");
    for (const label of labels) {
      const cell = document.createElement("th");
      cell.scope = "col";
      cell.textContent = label;
      headerRow.appendChild(cell);
    }
    head.appendChild(headerRow);
    table.appendChild(head);
    const body = document.createElement("tbody");
    for (const row of TraceVaultCircuit.truthTable()) {
      const tr = document.createElement("tr");
      if (activeBits && row.inputs.every((bit, index) => bit === activeBits[index]))
        tr.className = "current";
      for (const bit of [...row.inputs, ...row.outputs]) {
        const td = document.createElement("td");
        td.textContent = String(bit);
        tr.appendChild(td);
      }
      body.appendChild(tr);
    }
    table.appendChild(body);
  }

  function drawGates(result) {
    const container = el("vault-gates");
    container.replaceChildren();
    for (const gate of TraceVaultCircuit.gates) {
      const line = document.createElement("div");
      const actual = result?.trace.find((entry) => entry.gate === gate.out);
      line.textContent = `s${gate.out} = NAND(s${gate.a}, s${gate.b})` +
        (actual ? ` → ${actual.out}` : "");
      container.appendChild(line);
    }
    el("vault-netlist").textContent = TraceVaultCircuit.encode();
  }

  function render() {
    const simulated = inputIds.map((id) => Number(el(id).checked));
    if (!proof || proof.error) {
      output("vault-ready", "待核验");
      output("vault-wait", "待核验");
      output("vault-conclusion", proof?.error
        ? "主网查询失败，不能判定资格。" : "先读取 Circuit #1 的链上归属。");
      drawTable(null);
      drawGates(null);
      return;
    }
    const bits = [Number(proof.eligibleCircuit), ...simulated];
    const result = TraceVaultCircuit.evaluate(bits);
    output("vault-ready", result.canClaim ? "是 · 模拟" : "否 · 模拟");
    output("vault-wait", result.waitBudget ? "是 · 模拟" : "否 · 模拟");
    output("vault-conclusion", !proof.eligibleCircuit
      ? "此地址不持有演示白名单中的 Circuit #1。"
      : result.canClaim
        ? "链上资格成立；三个模拟条件允许领取。"
        : result.waitBudget
          ? "链上资格成立；模拟预算不足，等待补充。"
          : "链上资格成立；模拟窗口或领取记录阻止本轮领取。");
    drawTable(bits);
    drawGates(result);
  }

  async function checkOwner() {
    const currentRequest = ++requestNumber;
    const wallet = el("vault-wallet").value.trim();
    proof = null;
    el("vault-proof").className = "vault-proof";
    el("vault-proof").textContent = "正在只读核验 X Layer 主网…";
    el("vault-check").disabled = true;
    render();
    try {
      const found = await TraceVaultChain.verifyOwner(wallet);
      if (currentRequest !== requestNumber) return;
      proof = found;
      el("vault-proof").className = "vault-proof " +
        (found.eligibleCircuit ? "verified" : "unmatched");
      el("vault-proof").textContent = found.eligibleCircuit
        ? `已核验：Circuit #1 归此地址所有 · 区块 ${found.blockNumber} · ${found.endpoint}`
        : `已核验：此地址当前不符合演示白名单 · 区块 ${found.blockNumber} · ${found.reason}`;
    } catch (error) {
      if (currentRequest !== requestNumber) return;
      proof = { error: error.message };
      el("vault-proof").className = "vault-proof error";
      el("vault-proof").textContent = `核验失败：${error.message}`;
    } finally {
      if (currentRequest === requestNumber) el("vault-check").disabled = false;
      render();
    }
  }

  el("vault-wallet").addEventListener("input", () => {
    ++requestNumber;
    proof = null;
    el("vault-check").disabled = false;
    el("vault-proof").className = "vault-proof";
    el("vault-proof").textContent = "钱包地址已更改，请重新只读核验。";
    render();
  });
  el("vault-wallet").addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); checkOwner(); }
  });
  el("vault-check").addEventListener("click", checkOwner);
  for (const id of inputIds) el(id).addEventListener("change", render);
  render();
  checkOwner();
})();
