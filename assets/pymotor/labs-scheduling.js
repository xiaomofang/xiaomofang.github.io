(function () {
  "use strict";

  const SOURCE = "https://gitcode.com/Ascend/MindIE-PyMotor/blob/841e50dfa0b67ebe8f5da292669df4179f690ab1/";
  let instanceCount = 0;

  function sourceLink(file, label) {
    return '<a href="' + SOURCE + file + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
  }

  function format(value) {
    return value.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
  }

  function roundEven(value) {
    const lower = Math.floor(value);
    if (value - lower === 0.5) return lower % 2 === 0 ? lower : lower + 1;
    return Math.round(value);
  }

  function mountScheduling(root) {
    let load;
    let workers;
    let history;
    let guidedStep;
    const order = ["read-X", "read-Y", "commit-X", "commit-Y", "retry-Y", "release-X", "release-Y"];

    root.innerHTML = `
      <header class="pm-lab-head"><span class="pm-label">并发实验 · 对照 841e50df</span><h3>两个 Worker，读到了同一个 100</h3><p>分别提交负载 20，观察过期快照何时被 CAS 拒绝，再把两笔分配完整释放。</p></header>
      <div class="pm-controls"><button type="button" class="pm-button" data-action="guided">演示两 Worker 竞争</button><button type="button" class="pm-button" data-action="reset">重新开始</button></div>
      <div class="pm-stage" data-view aria-live="polite"></div>
      <p class="pm-insight" data-explanation></p>
      <ol class="pm-track" data-history aria-label="本轮操作记录"></ol>
      <p class="pm-label">同一 Coordinator 的共享负载教学模型，暂省略槽位删除与 generation 变化。${sourceLink("motor/coordinator/scheduler/runtime/scheduler_client.py", "查看 select_and_allocate()")}</p>`;

    function reset() {
      load = 100;
      workers = {
        X: { expected: null, allocated: false, released: false, result: "等待读取共享负载" },
        Y: { expected: null, allocated: false, released: false, result: "等待读取共享负载" }
      };
      history = [];
      guidedStep = 0;
    }

    function commit(name) {
      const worker = workers[name];
      if (worker.expected === null || worker.allocated) return;
      if (worker.expected !== load) {
        worker.result = "CHANGED · 期望 " + worker.expected + "，实际 " + load;
        history.push(name + " 提交失败，负载仍为 " + load + "。旧快照需要刷新。");
        return;
      }
      load += 20;
      worker.allocated = true;
      worker.result = "OK · 已记录实际提交量 20";
      history.push(name + " 提交成功，共享负载增加到 " + load + "。");
    }

    function act(action, guided) {
      if (!guided) guidedStep = -1;
      const [operation, name] = action.split("-");
      const worker = workers[name];
      if (!worker) return;
      if (operation === "read" && !worker.allocated) {
        worker.expected = load;
        worker.result = "已读取，等待提交";
        history.push(name + " 保存快照 " + load + "，计划增加 20。");
      }
      if (operation === "commit") commit(name);
      if (operation === "retry" && !worker.allocated && worker.expected !== null) {
        worker.expected = load;
        history.push(name + " 刷新快照为 " + load + "，本例继续选择同一端点。");
        commit(name);
      }
      if (operation === "release" && worker.allocated && !worker.released) {
        load -= 20;
        worker.released = true;
        worker.result = "已释放 20 · 本次尝试结束";
        history.push(name + " 按实际提交记录释放 20，共享负载回到 " + load + "。");
      }
    }

    function render() {
      root.querySelector("[data-view]").innerHTML = `
        <div class="pm-ledger"><span class="pm-label">共享负载 · 调度单位</span><strong class="pm-number">${load}</strong><span>初始 100 · 每笔分配 +20</span></div>
        <div class="pm-flow">${Object.entries(workers).map(([name, worker]) => `
          <section class="pm-node"><h4>Worker ${name}</h4><p>保存的期望值 <strong>${worker.expected === null ? "尚未读取" : worker.expected}</strong></p><p class="pm-status">${worker.result}</p>
            <div class="pm-controls"><button class="pm-button" type="button" data-action="read-${name}" ${worker.allocated ? "disabled" : ""}>读取</button><button class="pm-button" type="button" data-action="commit-${name}" ${worker.expected === null || worker.allocated ? "disabled" : ""}>尝试 +20</button><button class="pm-button" type="button" data-action="retry-${name}" ${worker.expected === null || worker.allocated ? "disabled" : ""}>刷新并重试</button><button class="pm-button" type="button" data-action="release-${name}" ${!worker.allocated || worker.released ? "disabled" : ""}>释放 20</button></div>
          </section>`).join("")}</div>`;
      root.querySelector("[data-history]").innerHTML = history.map(line => "<li>" + line + "</li>").join("");
      root.querySelector("[data-explanation]").textContent = history.length
        ? history.at(-1) + " CAS 只提交本次原子更新；请求记录、取消处理和释放确认继续维护完整生命周期。"
        : "先让 X 和 Y 都读取 100，再让 X 提交。Y 手里的 100 随即过期，重新提交时就能看见差异。";
      root.querySelector('[data-action="guided"]').textContent = guidedStep > 0 && guidedStep < order.length ? "继续下一步 · " + (guidedStep + 1) + " / " + order.length : "演示两 Worker 竞争";
    }

    root.addEventListener("click", function (event) {
      const button = event.target.closest("button[data-action]");
      if (!button || !root.contains(button) || button.disabled) return;
      const action = button.dataset.action;
      if (action === "reset") reset();
      else if (action === "guided") {
        if (guidedStep < 0 || guidedStep >= order.length) reset();
        act(order[guidedStep], true);
        guidedStep += 1;
      } else act(action, false);
      render();
    });
    reset();
    render();
  }

  function mountAffinity(root) {
    const id = "pm-affinity-" + (++instanceCount);
    const inputLength = 8192;
    const blockSize = 128;
    const defaults = { loadA: 6000, loadB: 1000, loadC: 0, cpu: 1, disk: 0, credit: 1, loadWeight: 1, threshold: 0, available: true };
    const endpoints = [
      { name: "A", npu: 48, cpu: 8, disk: 8 },
      { name: "B", npu: 16, cpu: 8, disk: 0 },
      { name: "C", npu: 0, cpu: 0, disk: 0 }
    ];
    let state = { ...defaults };
    let selected = "B";
    let tab = "score";
    const fields = [
      ["loadA", "A 当前负载", 12000, 100],
      ["loadB", "B 当前负载", 12000, 100],
      ["loadC", "C 当前负载", 12000, 100],
      ["cpu", "CPU 权重", 1, 0.05],
      ["disk", "Disk 权重", 1, 0.05],
      ["credit", "命中排序折扣 overlap_credit", 1.5, 0.05],
      ["loadWeight", "负载权重 load_weight", 2, 0.1],
      ["threshold", "加权命中率门槛", 1, 0.05]
    ];
    function range(field) {
      const [key, label, max, step] = field;
      return `<label class="pm-range" for="${id}-${key}"><span>${label} <output data-value="${key}">${state[key]}</output></span><input id="${id}-${key}" data-field="${key}" type="range" min="0" max="${max}" step="${step}" value="${state[key]}"></label>`;
    }
    root.innerHTML = `
      <header class="pm-lab-head"><span class="pm-label">缓存选路实验 · 对照 841e50df</span><h3>缓存最多的端点，会被选中吗？</h3><p>对同一个 8,192 token 请求，改变热点负载或介质权重，观察 Prefill 的选择与记账量。</p></header>
      <div class="pm-controls" role="tablist" aria-label="缓存实验"><button type="button" class="pm-button" role="tab" id="${id}-score-tab" aria-controls="${id}-score" aria-selected="true" data-tab="score">选路成本</button><button type="button" class="pm-button" role="tab" id="${id}-prefix-tab" aria-controls="${id}-prefix" aria-selected="false" data-tab="prefix">连续前缀</button></div>
      <section id="${id}-score" role="tabpanel" aria-labelledby="${id}-score-tab" data-panel="score">
        <div class="pm-controls"><button type="button" class="pm-button" data-preset="default">默认负载</button><button type="button" class="pm-button" data-preset="cool">A 变空闲</button><button type="button" class="pm-button" data-preset="threshold">阈值触发回退</button></div>
        <div class="pm-controls">${range(fields[0])}<label><input data-field="available" type="checkbox" checked> Conductor 本轮查询可用</label></div>
        <details class="pm-advanced"><summary>调整其他负载与策略参数</summary><div class="pm-controls">${fields.slice(1).map(range).join("")}</div></details>
        <div class="pm-stage" data-candidates></div>
        <p class="pm-status" data-decision aria-live="polite"></p>
        <div class="pm-insight" data-cost-detail aria-live="polite"></div>
        <p class="pm-label">三实例各提供一个 P 端点，块长固定 128，NPU 权重与 prefill_load_scale 固定为 1。柱长为本轮评分，占用模型单位；真实延迟还需测量。${sourceLink("motor/coordinator/scheduler/policy/kv_cache_affinity.py", "查看候选评分")}</p>
      </section>
      <section id="${id}-prefix" role="tabpanel" aria-labelledby="${id}-prefix-tab" data-panel="prefix" hidden>
        <div class="pm-controls"><label>新请求的第 3 块 <select data-prefix="query"><option value="C">C</option><option value="Q">Q</option></select></label><label>端点 B 的第 2 块 <select data-prefix="B"><option value="Q">Q</option><option value="B">B</option></select></label><label>端点 A 的最后一块 <select data-prefix="A"><option value="E">E</option><option value="D">D</option></select></label></div>
        <div class="pm-stage" data-prefix-view aria-live="polite"></div>
        <p class="pm-insight">每条路径从第一块开始比较，在首个差异处停止。改变此前上下文后，后面再次出现相同的 C 或 D，仍要服从连续前缀关系。</p>
        <p class="pm-label">方块字母代表 token block。此处演示最长公共前缀；实际索引还跟踪每个 worker 的持有关系与跨介质合法断点。${sourceLink("motor/kv_conductor/src/concurrent_tree.rs", "查看前缀树遍历")}</p>
      </section>`;

    function calculate() {
      return endpoints.map(endpoint => {
        const raw = blockSize * (endpoint.npu + endpoint.cpu + endpoint.disk);
        const matched = Math.min(inputLength, roundEven(blockSize * (endpoint.npu + state.cpu * endpoint.cpu + state.disk * endpoint.disk)));
        const cost = Math.max(0, inputLength - state.credit * matched);
        const load = state["load" + endpoint.name];
        return { ...endpoint, raw, matched, cost, load, score: cost + state.loadWeight * load, commit: inputLength - matched, lb: load * 1.05 };
      });
    }

    function renderScore() {
      const candidates = calculate();
      const bestRate = Math.max(...candidates.map(item => item.matched)) / inputLength;
      const lowHit = state.threshold > 0 && bestRate <= state.threshold;
      const fallback = !state.available || lowHit;
      const getScore = item => fallback ? item.lb : item.score;
      const best = Math.min(...candidates.map(getScore));
      const winners = candidates.filter(item => getScore(item) === best).map(item => item.name);
      const maxScore = Math.max(1, ...candidates.map(getScore));
      root.querySelector("[data-candidates]").innerHTML = `<div class="pm-candidates">${candidates.map(item => {
        const compute = fallback ? 0 : item.cost;
        const pressure = fallback ? item.lb : state.loadWeight * item.load;
        return `<button type="button" class="pm-candidate pm-button" data-endpoint="${item.name}" aria-pressed="${selected === item.name}" data-winner="${winners.includes(item.name)}"><span class="pm-row"><strong>P${item.name}</strong><span>${winners.includes(item.name) ? "最低评分 · " : ""}${format(getScore(item))}</span></span><span class="pm-bar" aria-hidden="true"><span class="pm-bar-compute" style="--fraction:${compute / maxScore}"></span><span class="pm-bar-load" style="--fraction:${pressure / maxScore}"></span></span><span class="pm-label">${fallback ? "负载均衡" : "剩余成本 " + format(item.cost) + " ＋ 负载项 " + format(pressure)}</span></button>`;
      }).join("")}</div><div class="pm-row pm-label"><span class="pm-legend-compute">剩余 Prefill 成本</span><span class="pm-legend-load">已有负载项</span></div>`;
      const reason = !state.available ? "查询不可用，转负载均衡。" : lowHit ? "最佳加权命中率没有严格超过门槛，转负载均衡。" : "使用 unified 评分。";
      root.querySelector("[data-decision]").textContent = reason + " 当前最低评分为 P" + winners.join("、P") + "。" + (winners.length > 1 ? "初选同分时源码会随机打散。" : "") + "此处展示候选，最后分配仍需 CAS 成功。";
      const item = candidates.find(candidate => candidate.name === selected);
      root.querySelector("[data-cost-detail]").innerHTML = `<strong>看清 P${selected} 的五个量</strong><p>原始覆盖 R = ${format(item.raw)} token；加权命中 M = ${format(item.matched)}；排序用剩余成本 C = ${format(item.cost)}；当前亲和评分 S = ${format(item.score)}。</p><p>${fallback ? "本轮使用负载均衡，已展示的缓存数据仅供对照。普通 P 路径提交输入长度 " + format(inputLength) : "若最终选中此端点，亲和路径提交 W = I − M = " + format(item.commit)}。overlap_credit 改变排序成本，提交量继续依据实际加权命中计算。</p><p class="pm-label">NPU / CPU / Disk 独占贡献为 ${item.npu} / ${item.cpu} / ${item.disk} 块。最佳加权命中率 ${(bestRate * 100).toFixed(2)}%，当前门槛 ${(state.threshold * 100).toFixed(0)}%。负载均衡示例采用每实例单端点、默认实例压力系数 0.05，因此评分为 1.05 × 当前负载。</p>`;
      for (const [key] of fields) {
        root.querySelector('[data-value="' + key + '"]').textContent = format(state[key]);
      }
    }

    function renderPrefix() {
      const query = ["A", "B", root.querySelector('[data-prefix="query"]').value, "D"];
      const paths = [
        { name: "端点 A", blocks: ["A", "B", "C", root.querySelector('[data-prefix="A"]').value] },
        { name: "端点 B", blocks: ["A", root.querySelector('[data-prefix="B"]').value, "C", "D"] },
        { name: "端点 C", blocks: [] }
      ];
      function tokens(blocks, match) {
        return blocks.map((block, index) => '<span class="pm-token" data-match="' + (index < match) + '">' + block + '</span>').join("");
      }
      root.querySelector("[data-prefix-view]").innerHTML = '<div class="pm-prefix-row"><strong>新请求</strong><div class="pm-prefix-blocks">' + tokens(query, 0) + '</div><span>从根开始</span></div>' + paths.map(item => {
        let matched = 0;
        while (matched < query.length && item.blocks[matched] === query[matched]) matched += 1;
        return '<div class="pm-prefix-row"><strong>' + item.name + '</strong><div class="pm-prefix-blocks">' + (item.blocks.length ? tokens(item.blocks, matched) : '<span class="pm-label">尚无缓存</span>') + '</div><span>连续命中 ' + matched + ' 块</span></div>';
      }).join("");
    }

    function updateControls() {
      for (const [key] of fields) root.querySelector('[data-field="' + key + '"]').value = state[key];
      root.querySelector('[data-field="available"]').checked = state.available;
    }

    root.addEventListener("input", function (event) {
      const key = event.target.dataset.field;
      if (!key) return;
      state[key] = key === "available" ? event.target.checked : Number(event.target.value);
      renderScore();
    });
    root.addEventListener("change", function (event) {
      if (event.target.dataset.prefix) renderPrefix();
    });
    root.addEventListener("click", function (event) {
      const button = event.target.closest("button");
      if (!button || !root.contains(button)) return;
      if (button.dataset.tab) {
        tab = button.dataset.tab;
        root.querySelectorAll("[data-tab]").forEach(node => node.setAttribute("aria-selected", String(node.dataset.tab === tab)));
        root.querySelectorAll("[data-panel]").forEach(node => { node.hidden = node.dataset.panel !== tab; });
      }
      if (button.dataset.preset) {
        state = { ...defaults };
        if (button.dataset.preset === "cool") state.loadA = 3000;
        if (button.dataset.preset === "threshold") state.threshold = 0.9;
        updateControls();
        renderScore();
      }
      if (button.dataset.endpoint) {
        selected = button.dataset.endpoint;
        renderScore();
      }
    });
    root.addEventListener("keydown", function (event) {
      const button = event.target.closest("[data-tab]");
      if (!button || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const other = root.querySelector('[data-tab="' + (tab === "score" ? "prefix" : "score") + '"]');
      other.click();
      other.focus();
    });
    renderScore();
    renderPrefix();
  }

  function mountStreaming(root) {
    const id = "pm-stream-" + (++instanceCount);
    let stage = 0;
    let generated = 12;
    let failed = false;
    const stages = ["上游尚未就绪", "HTTP 200 已发送", "已经发送输出 token"];
    root.innerHTML = `
      <header class="pm-lab-head"><span class="pm-label">流式边界实验 · 对照 841e50df</span><h3>同一次断连，发生时机会改变什么？</h3><p>把故障放到响应提交前、响应头之后或可见内容之后，观察错误合同与重试计划。</p></header>
      <div class="pm-controls" aria-label="选择故障时刻">${stages.map((label, index) => `<button type="button" class="pm-button" data-stage="${index}" aria-pressed="${index === 0}">${label}</button>`).join("")}</div>
      <div class="pm-controls"><label for="${id}-connection">中断哪条连接 <select id="${id}-connection" data-connection><option value="upstream">引擎上游连接</option><option value="client">客户端连接</option></select></label><label><input type="checkbox" data-replay checked> 重放条件齐备</label></div>
      <label class="pm-range" for="${id}-generated"><span>已经输出的 token <output data-generated>12</output> / 128</span><input id="${id}-generated" type="range" min="1" max="128" value="12" data-count></label>
      <div class="pm-stage" data-stream-view aria-live="polite"></div>
      <div class="pm-controls"><button type="button" class="pm-button" data-interrupt>在当前时刻中断连接</button><button type="button" class="pm-button" data-reset>清除故障</button></div>
      <div class="pm-insight" data-plan aria-live="polite"></div>
      <p class="pm-label">教学模型假定错误可计入传输重试且仍有重试次数。重放条件齐备包含已启用续接、单 prompt / 单 choice、有效 prompt 与完整输出 token ID 缓存、受支持的文本合同和未结束的流。${sourceLink("motor/coordinator/router/stream_response.py", "查看响应提交") } · ${sourceLink("motor/coordinator/router/rescheduler/rescheduler.py", "查看重放条件")}</p>`;

    function render() {
      const replay = root.querySelector("[data-replay]").checked;
      const connection = root.querySelector("[data-connection]").value;
      const visible = stage === 2 ? generated : 0;
      const remaining = Math.max(0, 128 - visible);
      root.querySelector("[data-generated]").textContent = generated;
      root.querySelector("[data-count]").disabled = stage !== 2;
      root.querySelector("[data-replay]").disabled = stage !== 2;
      root.querySelectorAll("[data-stage]").forEach(button => button.setAttribute("aria-pressed", String(Number(button.dataset.stage) === stage)));
      root.querySelector("[data-stream-view]").innerHTML = `<ol class="pm-track pm-stepper">${stages.map((label, index) => `<li data-active="${index === stage}" data-complete="${index < stage}"><span>${label}</span></li>`).join("")}</ol><div class="pm-row"><span class="pm-status">HTTP 状态 ${stage === 0 ? "仍可决定" : "已提交为 200"}</span><span class="pm-status">客户端可见输出 ${visible} token</span><span class="pm-status">概念剩余预算 ${remaining}</span></div>`;
      let heading = "先选一个时刻，再让连接中断";
      let explanation = "HTTP 状态的提交与首个内容的发送是两个边界。移动故障时刻，先观察这两项状态，再判断错误如何返回。";
      if (failed && connection === "client") {
        heading = "客户端已经离开，进入取消与清理";
        explanation = "停止相关上游任务，按实际分配记录回收负载并清理请求。该连接已经终止，继续生成无法送达这个客户端；这种主动断开通常也不应直接累计为引擎失败。";
      } else if (failed && stage === 0) {
        heading = "先尝试新的上游 attempt，错误状态仍可返回";
        explanation = "本例尚未满足 readiness 屏障，响应也未提交。可重试错误可以进入新尝试；重试耗尽后，仍有机会返回准确的 HTTP 错误状态与错误体。源码把 readiness 视为语义提交边界，刚就绪但尚未实际发送响应头的窄窗口也需要单独处理。";
      } else if (failed && stage === 1) {
        heading = "可以继续尝试上游，HTTP 200 已经确定";
        explanation = "首个正文尚未发送时，普通传输重试分支仍可尝试新的上游 attempt。响应头已经提交，最终失败通过流内 error 结束，无法重新发送一份 HTTP 错误状态。混部整次 restart 另受 commit_sealed 限制，不能把所有回退都视为同一个动作。";
      } else if (failed && replay) {
        heading = "先重放有效 token 前缀，再从新端点续接";
        explanation = "本例满足 can_resume_after_visible_output 的条件。新请求由原 prompt token ID 与累计生成 token ID 组成，客户端继续接收后续输出。重放保留已经生成的上下文，后续输出仍受采样与引擎执行影响。若续接最终失败，返回流内 error 并结束。";
      } else if (failed) {
        heading = "可见输出已经产生，当前合同不允许安全续接";
        explanation = "缺少完整 token 进度、请求包含工具或其他不支持结构、多个 choice 等情况，可能使重放条件不成立。此时传播流内 error 并结束，同时完成任务和账本清理。错误帧需要由客户端按错误合同处理。";
      }
      const budget = stage === 2 ? `<p class="pm-label">原始上限 128，累计输出 ${visible}，概念剩余 ${remaining}。当前 apply_retry_plan() 对下发 max_tokens 使用 max(1, 原始上限 − 累计输出)，因此本例的字段值为 ${Math.max(1, remaining)}；预算边界还需结合调用方和完成状态解释。</p>` : "";
      root.querySelector("[data-plan]").innerHTML = "<strong>" + heading + "</strong><p>" + explanation + "</p>" + budget;
    }

    root.addEventListener("click", function (event) {
      const button = event.target.closest("button");
      if (!button || !root.contains(button)) return;
      if (button.dataset.stage !== undefined) {
        stage = Number(button.dataset.stage);
        failed = false;
      }
      if (button.hasAttribute("data-interrupt")) failed = true;
      if (button.hasAttribute("data-reset")) failed = false;
      render();
    });
    root.addEventListener("input", function (event) {
      if (event.target.hasAttribute("data-count")) generated = Number(event.target.value);
      render();
    });
    root.addEventListener("change", render);
    render();
  }

  Object.assign(window.PyMotorLabs ||= {}, { mountScheduling, mountAffinity, mountStreaming });
})();
