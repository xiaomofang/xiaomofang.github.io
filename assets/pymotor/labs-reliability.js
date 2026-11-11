(() => {
  "use strict";

  const SOURCE = "https://gitcode.com/Ascend/MindIE-PyMotor/blob/841e50dfa0b67ebe8f5da292669df4179f690ab1/";
  const link = (path, label) => `<a href="${SOURCE}${path}">${label}</a>`;
  const number = value => value.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
  const button = (action, label) => `<button type="button" class="pm-button" data-action="${action}">${label}</button>`;
  const check = (name, label, checked = true) => `<label class="pm-label"><input type="checkbox" name="${name}" ${checked ? "checked" : ""}> ${label}</label>`;

  function mountNode(root) {
    const config = {
      alive: true, health: true, virtual: true, success: true,
      capacity: "none", cube: "low", lease: 0, supervisor: true
    };
    let run;

    root.innerHTML = `
      <div class="pm-lab-head"><h3>同一个异常，NM 会怎样决定下一步</h3><p>教学模型 · 源码 841e50df · 已完成预热、曾正常运行、已过启动宽限期，拓扑保持稳定。</p></div>
      <div class="pm-controls">
        ${check("alive", "引擎进程存活")}${check("health", "原生 /health 通过")}
        ${check("virtual", "启用 vLLM 虚推")}${check("success", "虚推请求成功")}
        <label class="pm-label">AI Cube 信号 <select name="cube"><option value="low">低于使用率阈值</option><option value="high">达到使用率阈值</option><option value="unknown">采样不可用</option></select></label>
        <label class="pm-label">容量等待 <select name="capacity"><option value="none">0，无容量排队</option><option value="waiting">有请求等待容量</option><option value="unknown">指标不可用</option></select></label>
        <label class="pm-label">guard 剩余租期 <output data-lease>0</output> 秒<input type="range" name="lease" min="0" max="30" step="3" value="0"></label>
        ${check("supervisor", "外部容器监督器接管退出")}
      </div>
      <div class="pm-stepper">${button("sample", "采样并执行一轮仲裁")}${button("reset", "重置观察计数")}</div>
      <div class="pm-stage" data-stage aria-live="polite"></div>
      <p class="pm-insight" data-insight></p>
      <p>改条件会重置观察。每次点击合并一次虚推与仲裁，租期减 3 秒。虚推上限取 3，NM 上限为 5，假定无额外 Controller freeze。</p>
      <details class="pm-code"><summary>为什么虚推失败仍可能保持 NM 运行</summary><p>低 AI Cube、虚推失败且容量等待为 0 时才累计虚推失败。容量排队或信号缺失会跳过计数；虚推异常形成后，NM 继续按 guard 与外部监督条件仲裁。${link("motor/node_manager/core/services/native_engine/virtual_inference/worker.py", "核对虚推条件")} · ${link("motor/node_manager/core/daemon.py", "核对退出仲裁")}</p></details>`;

    function reset() {
      run = { samples: 0, virtualFailures: 0, abnormal: false, daemonFailures: 0,
        remaining: config.lease, exit: false, fact: "等待采样", decision: "尚未累计异常" };
    }

    function render() {
      const nativeReady = config.alive && config.health;
      const observedAbnormal = !nativeReady || run.abnormal;
      root.querySelector("[data-lease]").textContent = config.lease;
      root.querySelector("[data-stage]").innerHTML = `
        <div class="pm-topology">
          <div class="pm-node"><span class="pm-label">进程事实</span><strong>${config.alive ? "存活" : "已退出"}</strong></div>
          <div class="pm-node"><span class="pm-label">业务探针</span><strong>${!config.alive ? "进程退出，跳过探针" : config.health ? "/health 通过" : "/health 失败"}</strong></div>
          <div class="pm-node"><span class="pm-label">虚推事实</span><strong>${run.fact}</strong></div>
          <div class="pm-node" data-state="${observedAbnormal ? "failed" : "normal"}"><span class="pm-label">端点事实</span><strong>${observedAbnormal ? "ABNORMAL" : "正常"}</strong></div>
        </div>
        <div class="pm-row"><span>虚推累计 ${run.virtualFailures} / 3</span><meter min="0" max="3" value="${run.virtualFailures}">${run.virtualFailures}/3</meter></div>
        <div class="pm-row"><span>NM 连续异常 ${run.daemonFailures} / 5</span><meter min="0" max="5" value="${run.daemonFailures}">${run.daemonFailures}/5</meter></div>
        <p class="pm-status">第 ${run.samples} 轮 · guard 剩余 ${run.remaining} 秒 · ${run.decision}</p>`;
      root.querySelector("[data-insight]").textContent = run.exit
        ? "本轮已设置 should_suicide，交由主循环退出和外部监督器接管。调整任一条件或重置，可以重新观察计数过程。"
        : "观察虚推计数与 NM 计数的先后关系。guard 使本轮 NM 异常计数归零，容量等待则影响虚推是否产生新的异常事实。";
      root.querySelector('[data-action="sample"]').disabled = run.exit;
    }

    function sample() {
      if (run.exit) return;
      run.samples += 1;
      if (!config.alive || !config.health) {
        run.fact = "原生运行态未就绪，本轮不运行虚推";
      } else if (!config.virtual) {
        run.fact = "虚推未启用，使用原生健康事实";
      } else if (run.abnormal) {
        run.fact = "已达到虚推阈值，异常标志保持";
      } else if (config.success || config.cube === "high") {
        run.virtualFailures = 0;
        run.fact = config.success ? "虚推成功，失败计数归零" : "高使用率，失败计数归零";
      } else if (config.cube === "unknown" || config.capacity !== "none") {
        run.fact = "请求失败，本轮信号不足或容量排队，跳过计数";
      } else {
        run.virtualFailures += 1;
        run.abnormal = run.virtualFailures >= 3;
        run.fact = run.abnormal ? "连续失败达到 3 次，标记异常" : "低使用率且无容量排队，累计一次失败";
      }

      if (run.remaining > 0) {
        run.daemonFailures = 0;
        run.decision = "guard 有效，本轮暂停退出累计";
      } else if (!config.alive || !config.health || run.abnormal) {
        run.daemonFailures += 1;
        run.decision = "累计一次端点异常观察";
        if (run.daemonFailures >= 5) {
          if (config.supervisor) {
            run.exit = true;
            run.decision = "设置 should_suicide，等待主循环处理";
          } else {
            run.daemonFailures = 0;
            run.decision = "达到阈值，外部监督未启用，保持 NM 运行并清零";
          }
        }
      } else {
        run.daemonFailures = 0;
        run.decision = "端点正常，连续异常计数归零";
      }
      run.remaining = Math.max(0, run.remaining - 3);
      render();
    }

    root.addEventListener("change", event => {
      const field = event.target;
      if (!Object.hasOwn(config, field.name)) return;
      config[field.name] = field.type === "checkbox" ? field.checked : field.name === "lease" ? Number(field.value) : field.value;
      reset();
      render();
    });
    root.addEventListener("click", event => {
      const action = event.target.closest("[data-action]")?.dataset.action;
      if (action === "sample") sample();
      if (action === "reset") { reset(); render(); }
    });
    reset();
    render();
  }

  function mountRecovery(root) {
    const phases = ["证据", "能力门槛", "guard / status", "确认撤流", "apply", "finalize", "发布幸存者"];
    const config = { failed: 2, capability: true, ready: true, withdrawFail: false };
    const committed = new Set();
    let attempt;
    let published = [0, 1, 2, 3];
    let setMessage = "";

    root.innerHTML = `
      <div class="pm-lab-head"><h3>把一次 DP 缩容走到提交边界</h3><p>教学模型 · 源码 841e50df · 原始 DP 集合 {0,1,2,3}，每轮只注入一个明确 DEAD rank。</p></div>
      <div class="pm-controls">
        <label class="pm-label">本轮故障 DP <select name="failed"></select></label>
        ${check("capability", "满足 FT、external LB、EPLB 与冗余专家门槛")}
        ${check("ready", "幸存者已进入 apply-ready 状态")}
        ${check("withdrawFail", "注入撤流确认失败", false)}
      </div>
      <div class="pm-stepper">${button("advance", "推进一步")}${button("next", "开始下一轮故障")}${button("set", "发送全量 SET")}${button("reset-all", "还原四 DP")}</div>
      <div class="pm-stage" data-stage aria-live="polite"></div>
      <p class="pm-insight" data-insight></p>
      <p>改条件会开始新尝试，以已提交拓扑作为实验起点。实际还有状态机与熔断并行隔离。本实验假定引擎 apply 成功，再展开提交与发布。</p>
      <details class="pm-code"><summary>为什么第二轮需要累计移除集合</summary><p>第一轮退役 DP2，第二轮 DP0 故障时，传给引擎的 removed_dp_ranks 为 {0,2}，幸存 master 为 DP1。ServingOverlay 在后续 ADD、RESUME、SET 中继续过滤 dead_committed。${link("motor/controller/fault_tolerance/strategy/dp_scale_down.py", "核对事务执行")} · ${link("motor/controller/fault_tolerance/serving_overlay.py", "核对服务投影")}</p></details>`;

    function resetAttempt() {
      attempt = { phase: -1, outcome: "idle", applied: false, guarded: false, finalized: false,
        message: "选择故障条件，再逐步观察。", master: null };
      published = [0, 1, 2, 3].filter(rank => !committed.has(rank));
      setMessage = "";
    }

    function removed() {
      return new Set([...committed, config.failed]);
    }

    function survivors() {
      const dead = removed();
      return [0, 1, 2, 3].filter(rank => !dead.has(rank));
    }

    function ranks(items) {
      const values = [...items].sort((a, b) => a - b);
      return `{${values.join(", ")}}`;
    }

    function render() {
      root.querySelector('[name="failed"]').innerHTML = [0, 1, 2, 3].map(rank =>
        `<option value="${rank}" ${rank === config.failed ? "selected" : ""} ${committed.has(rank) ? "disabled" : ""}>DP${rank}${committed.has(rank) ? " · 已提交退役" : ""}</option>`
      ).join("");
      const alive = survivors();
      const master = attempt.master ?? (published.length ? Math.min(...published) : null);
      root.querySelector("[data-stage]").innerHTML = `
        <ol class="pm-flow">${phases.map((phase, index) => `<li class="pm-node ${index === attempt.phase ? "is-active" : ""}" data-state="${index === attempt.phase ? "active" : index < attempt.phase ? "done" : "pending"}">${index + 1}. ${phase}</li>`).join("")}</ol>
        <div class="pm-topology">${[0, 1, 2, 3].map(rank => {
          const retired = committed.has(rank);
          const pending = !retired && rank === config.failed;
          return `<div class="pm-node" data-state="${retired || pending ? "failed" : "normal"}"><strong>DP${rank}</strong><span>${retired ? "已提交退役" : pending ? "本轮 DEAD 候选" : "幸存者"}</span></div>`;
        }).join("")}</div>
        <div class="pm-code">dead_committed = ${ranks(committed)}<br>本轮累计移除 = ${ranks(removed())}<br>幸存者 = ${ranks(alive)}<br>apply = ${attempt.applied ? "已发出" : "未发出"} · guard = ${attempt.guarded ? "有效" : "未持有"}<br>已发布成员 = ${ranks(published)} · 当前显示 master = ${master === null ? "无可服务 master" : `DP${master}`}</div>
        <p class="pm-status">${attempt.message}</p>${setMessage ? `<p>${setMessage}</p>` : ""}`;
      root.querySelector("[data-insight]").textContent = attempt.outcome === "success"
        ? "恢复已提交。现在发送 SET，观察退役 DP 始终被过滤；再开始下一轮，观察累计移除集合与 master 改变。"
        : attempt.outcome === "fallback"
          ? "当前尝试已转入整实例重配置。修改条件会建立新尝试，前一轮已经提交的退役记录继续保留。"
          : "apply 之前要先通过能力检查、幸存者就绪检查和撤流确认。finalize 提交以后，退役记录才进入 dead_committed。";
      root.querySelector('[data-action="advance"]').disabled = ["success", "fallback"].includes(attempt.outcome);
      root.querySelector('[data-action="next"]').disabled = attempt.outcome !== "success" || committed.size >= 4;
    }

    function advance() {
      if (["success", "fallback"].includes(attempt.outcome)) return;
      if (attempt.phase === 2 && !config.ready) {
        attempt.message = "仍在等待幸存者进入 unhealthy 且非 recovering。调整条件会重新开始本轮。";
        render();
        return;
      }
      attempt.phase += 1;
      attempt.outcome = "running";
      const alive = survivors();
      if (attempt.phase === 0) attempt.message = `证据确认 DP${config.failed} DEAD，按原始 rank 坐标收集本轮候选。`;
      if (attempt.phase === 1) {
        if (!config.capability || alive.length === 0) {
          attempt.outcome = "fallback";
          published = [];
          attempt.message = alive.length === 0 ? "无幸存 rank，转入整实例重配置。" : "能力门槛拒绝局部缩容，转入整实例重配置。";
        } else attempt.message = "能力门槛通过，继续建立本轮 NM 保护。";
      }
      if (attempt.phase === 2) {
        attempt.guarded = true;
        attempt.message = config.ready ? "guard 已建立，幸存者 status 满足 apply-ready，下一步确认撤流。" : "guard 已建立，status 仍在等待，apply 保持未发出。";
      }
      if (attempt.phase === 3) {
        if (config.withdrawFail) {
          attempt.outcome = "fallback";
          attempt.guarded = false;
          attempt.message = "撤流确认失败，停止推进并 finalize abort，apply 未发出。随后走整实例重配置。";
        } else {
          published = [];
          attempt.message = "撤流已确认，Coordinator 发布视图为空，下一步才允许 apply。";
        }
      }
      if (attempt.phase === 4) {
        attempt.applied = true;
        attempt.master = Math.min(...alive);
        attempt.message = `向幸存引擎发出一次 apply，removed_dp_ranks=${ranks(removed())}，新 master 为 DP${attempt.master}。`;
      }
      if (attempt.phase === 5) {
        attempt.finalized = true;
        attempt.guarded = false;
        committed.add(config.failed);
        attempt.message = "引擎返回成功，NM finalize commit，提交退役集合。服务仍等待发布。";
      }
      if (attempt.phase === 6) {
        published = [0, 1, 2, 3].filter(rank => !committed.has(rank));
        attempt.outcome = "success";
        attempt.message = `发布幸存者 ${ranks(published)}，本轮完成。`;
      }
      setMessage = "";
      render();
    }

    root.addEventListener("change", event => {
      const field = event.target;
      if (!Object.hasOwn(config, field.name)) return;
      config[field.name] = field.type === "checkbox" ? field.checked : Number(field.value);
      resetAttempt();
      render();
    });
    root.addEventListener("click", event => {
      const action = event.target.closest("[data-action]")?.dataset.action;
      if (action === "advance") advance();
      if (action === "next" && attempt.outcome === "success") {
        config.failed = [0, 1, 2, 3].find(rank => !committed.has(rank)) ?? 0;
        resetAttempt();
        render();
      }
      if (action === "set") {
        const inRecovery = attempt.phase >= 0 && attempt.outcome !== "success";
        published = inRecovery ? [] : [0, 1, 2, 3].filter(rank => !committed.has(rank));
        setMessage = `SET 使用当前 ServingOverlay 投影 ${ranks(published)}，累计退役 ${ranks(committed)}。`;
        render();
      }
      if (action === "reset-all") {
        committed.clear();
        config.failed = 2;
        resetAttempt();
        render();
      }
    });
    resetAttempt();
    render();
  }

  function mountMetrics(root) {
    const ratio = { ah: 90, aq: 100, bh: 1, bq: 10 };
    const phases = [
      { key: "tokenize", label: "Tokenize", value: 20 },
      { key: "route", label: "路由选择", value: 5 },
      { key: "pwait", label: "P 排队", value: 120 },
      { key: "pcompute", label: "P 计算", value: 280 },
      { key: "kv", label: "KV 交接", value: 60 },
      { key: "dfirst", label: "D 首 token", value: 25 }
    ];
    root.innerHTML = `
      <div class="pm-lab-head"><h3>统计口径与请求时间线</h3><p>教学模型 · 源码 841e50df · 数值用于手算与归因练习。</p></div>
      <div class="pm-stepper">${button("ratio", "聚合命中率")}${button("timeline", "拆解 TTFT")}</div>
      <div data-ratio-view>
        <div class="pm-controls">
          <label class="pm-label">A 命中<input type="number" name="ah" min="0" step="1" value="90"></label>
          <label class="pm-label">A 查询<input type="number" name="aq" min="1" step="1" value="100"></label>
          <label class="pm-label">B 命中<input type="number" name="bh" min="0" step="1" value="1"></label>
          <label class="pm-label">B 查询<input type="number" name="bq" min="1" step="1" value="10"></label>
          ${check("equal", "改成等查询量（按当前比例取整命中数）", false)}
          ${button("reset-ratio", "恢复 90/100 与 1/10")}
        </div>
        <div class="pm-stage" data-ratio-stage aria-live="polite"></div>
        <p class="pm-insight" data-ratio-insight></p>
        <p>查询数最小为 1，命中数约束在 0 到查询数之间。实际指标需核对注册表中的分子、分母和标签。</p>
      </div>
      <div data-timeline-view hidden>
        <div class="pm-controls">${phases.map(phase => `<label class="pm-label">${phase.label} <output data-time="${phase.key}">${phase.value}</output> ms<input type="range" name="${phase.key}" min="0" max="1000" step="5" value="${phase.value}"></label>`).join("")}</div>
        <div class="pm-stage" data-timeline-stage aria-live="polite"></div>
        <p class="pm-insight" data-timeline-insight></p>
        <p>HANDOFF 串行教学样本，省略其他网络开销。各段起点为前面阶段之和。</p>
      </div>
      <details class="pm-code"><summary>为什么服务命中率要先加分子与分母</summary><p>每个端点对服务比例的贡献随查询量变化。语义聚合器根据 RatioPair 从合并后的计数派生比例。单次请求的时间线则应追到 Router 设置事件与首 token 的调用位置。${link("motor/coordinator/metrics/aggregation_engine.py", "核对比例聚合")} · ${link("motor/coordinator/tracer/tracing.py", "核对 Trace 边界")}</p></details>`;

    function renderRatio() {
      const ar = ratio.ah / ratio.aq;
      const br = ratio.bh / ratio.bq;
      const hits = ratio.ah + ratio.bh;
      const queries = ratio.aq + ratio.bq;
      const aggregate = hits / queries;
      const average = (ar + br) / 2;
      root.querySelector("[data-ratio-stage]").innerHTML = `
        <div class="pm-candidates">
          <div class="pm-node"><span class="pm-label">A · 权重 ${(100 * ratio.aq / queries).toFixed(1)}%</span><strong>${ratio.ah} / ${ratio.aq} = ${(ar * 100).toFixed(2)}%</strong><div class="pm-track"><span class="pm-bar" style="width:${ar * 100}%"></span></div></div>
          <div class="pm-node"><span class="pm-label">B · 权重 ${(100 * ratio.bq / queries).toFixed(1)}%</span><strong>${ratio.bh} / ${ratio.bq} = ${(br * 100).toFixed(2)}%</strong><div class="pm-track"><span class="pm-bar" style="width:${br * 100}%"></span></div></div>
        </div>
        <p class="pm-status">服务命中率 ${hits} / ${queries} = ${(aggregate * 100).toFixed(2)}%</p>
        <div class="pm-code">先汇总计数 → (${ratio.ah}+${ratio.bh}) / (${ratio.aq}+${ratio.bq})<br>端点比例的算术平均 → (${(ar * 100).toFixed(2)}% + ${(br * 100).toFixed(2)}%) / 2 = ${(average * 100).toFixed(2)}%</div>`;
      root.querySelector("[data-ratio-insight]").textContent = ratio.aq === ratio.bq
        ? "两个端点查询量相同，每个端点各贡献一半样本，此时算术平均与服务命中率一致。取消等量或调整查询数，观察差异。"
        : `A 贡献 ${(ratio.aq / queries * 100).toFixed(1)}% 的查询。服务比例按这些样本加权，两种计算相差 ${Math.abs(aggregate - average) * 100 < 0.005 ? "0" : (Math.abs(aggregate - average) * 100).toFixed(2)} 个百分点。`;
      for (const key of Object.keys(ratio)) root.querySelector(`[name="${key}"]`).value = ratio[key];
      root.querySelector('[name="equal"]').checked = ratio.aq === ratio.bq;
    }

    function renderTimeline() {
      const total = phases.reduce((sum, phase) => sum + phase.value, 0);
      const maximum = Math.max(...phases.map(phase => phase.value));
      const dominant = phases.filter(phase => phase.value === maximum).map(phase => phase.label);
      let start = 0;
      const graphic = phases.map(phase => {
        const end = start + phase.value;
        const row = `<div class="pm-row" style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,3fr) minmax(0,1fr)"><span class="pm-label">${phase.label}${phase.value === maximum ? " · 最大" : ""}</span><div class="pm-track"><span class="pm-bar" style="margin-inline-start:${total ? start / total * 100 : 0}%;width:${total ? phase.value / total * 100 : 0}%"></span></div><span>${start}→${end} ms</span></div>`;
        start = end;
        root.querySelector(`[data-time="${phase.key}"]`).textContent = phase.value;
        return row;
      }).join("");
      root.querySelector("[data-timeline-stage]").innerHTML = `<p class="pm-status">演算 TTFT = ${number(total)} ms</p><div>${graphic}</div><div class="pm-code">${phases.map(phase => phase.value).join(" + ")} = ${total} ms</div>`;
      root.querySelector("[data-timeline-insight]").textContent = total > 0
        ? `最大阶段为 ${dominant.join("、")}，占总和 ${(maximum / total * 100).toFixed(1)}%。改变这一阶段 50 ms，总和随之改变 50 ms；真实归因还需从同一请求的 Trace 核对边界。`
        : "所有演算阶段都为零。调高任一阶段，观察首 token 时间与后续阶段起点同时变化。";
    }

    root.addEventListener("input", event => {
      const field = event.target;
      const phase = phases.find(item => item.key === field.name);
      if (phase) {
        phase.value = Number(field.value);
        renderTimeline();
      }
    });
    root.addEventListener("change", event => {
      const field = event.target;
      if (Object.hasOwn(ratio, field.name)) {
        const value = Number(field.value);
        ratio[field.name] = Math.max(field.name.endsWith("q") ? 1 : 0, Number.isFinite(value) ? Math.round(value) : 0);
        ratio.ah = Math.min(ratio.ah, ratio.aq);
        ratio.bh = Math.min(ratio.bh, ratio.bq);
        renderRatio();
      }
      if (field.name === "equal") {
        if (field.checked) {
          const queries = Math.max(ratio.aq, ratio.bq);
          ratio.ah = Math.round(ratio.ah / ratio.aq * queries);
          ratio.bh = Math.round(ratio.bh / ratio.bq * queries);
          ratio.aq = queries;
          ratio.bq = queries;
        } else Object.assign(ratio, { ah: 90, aq: 100, bh: 1, bq: 10 });
        renderRatio();
      }
    });
    root.addEventListener("click", event => {
      const action = event.target.closest("[data-action]")?.dataset.action;
      if (action === "ratio" || action === "timeline") {
        root.querySelector("[data-ratio-view]").hidden = action !== "ratio";
        root.querySelector("[data-timeline-view]").hidden = action !== "timeline";
      }
      if (action === "reset-ratio") {
        Object.assign(ratio, { ah: 90, aq: 100, bh: 1, bq: 10 });
        renderRatio();
      }
    });
    renderRatio();
    renderTimeline();
  }

  Object.assign(window.PyMotorLabs ||= {}, { mountNode, mountRecovery, mountMetrics });
})();
