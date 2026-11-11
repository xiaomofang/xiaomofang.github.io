(function () {
  const sourceBase = "https://gitcode.com/Ascend/MindIE-PyMotor/blob/841e50dfa0b67ebe8f5da292669df4179f690ab1/";
  let topologySequence = 0;

  function sourceLink(file, symbol) {
    return '<a href="' + sourceBase + file + '" target="_blank" rel="noopener noreferrer">' + symbol + '</a>';
  }

  function head(title, description) {
    return '<div class="pm-lab-head"><p class="pm-label">教学模型 · 对照 841e50df</p><h3>' + title + '</h3><p>' + description + '</p></div>';
  }

  function stepList(titles, position) {
    return '<ol class="pm-stepper">' + titles.map(function (title, index) {
      const state = index === position ? "current" : index < position ? "done" : "pending";
      return '<li data-state="' + state + '"><span>' + String(index + 1).padStart(2, "0") + '</span> ' + title + '</li>';
    }).join("") + '</ol>';
  }

  function fact(label, value) {
    return '<div><dt>' + label + '</dt><dd>' + value + '</dd></div>';
  }

  function mountOverview(root) {
    const paths = {
      request: {
        name: "跟随一次请求",
        route: "客户端 → Coordinator → P → Coordinator → D → Coordinator → 客户端",
        active: ["client", "coordinator", "prefill", "decode"],
        detail: "HANDOFF 中，P 返回的交接票据经 Coordinator 注入 D 请求。KV 张量由引擎及 Connector 搬运。"
      },
      control: {
        name: "追踪引擎上线",
        route: "NodeManager 注册 → Controller 组装 → NodeManager 启动引擎 → 心跳 → Coordinator",
        active: ["controller", "node", "prefill", "decode", "coordinator"],
        detail: "Controller 维护实例生命状态，再将可服务视图发布给 Coordinator。Worker 获得成员之后才有选路目标。"
      },
      cache: {
        name: "查看缓存选路",
        route: "引擎 KV 事件 → Conductor 索引 ← Coordinator 查询 → P 端点选择",
        active: ["prefill", "conductor", "coordinator"],
        detail: "Conductor 返回前缀覆盖信息，Worker 再结合当前负载评分，并通过共享内存提交分配。"
      }
    };
    const nodes = {
      client: { name: "客户端", short: "用户请求与可见输出", owner: "messages、生成约束与端到端延迟", body: "从客户端能观察到请求成功、首 token 和后续输出时间。定位延迟时，再用请求身份连接内部阶段。", file: "motor/coordinator/api_server/inference_server.py", symbol: "InferenceServer", question: "TTFT 应从哪里开始计时？", answer: "客户端端到端 TTFT 从发出请求到首个可见 token，内部阶段指标需要结合各自统计边界解释。" },
      coordinator: { name: "Coordinator", short: "请求入口与阶段编排", owner: "Worker 请求上下文；Mgmt 成员；共享负载账本", body: "Worker 建立 RequestInfo 和 attempt，选择端点、执行协议并回收记录。Mgmt 提供成员和控制状态。", file: "motor/coordinator/router/dispatch.py", symbol: "handle_request", question: "请求分配是在哪个进程完成的？", answer: "Inference Worker 中的 SchedulerClient 本地选择候选，再经 Rust 共享内存 CAS 提交。Mgmt 维护成员和控制状态。" },
      prefill: { name: "P 引擎", short: "处理输入，建立 KV", owner: "引擎内的序列、KV block 与执行队列", body: "引擎执行 Prefill，并按协议返回交接信息。缓存亲和试图减少这里需要重新计算的前缀。", file: "motor/coordinator/router/adapters/pd_protocol.py", symbol: "build_prefill_request", question: "P 的 HTTP 请求成功就能进入 D 吗？", answer: "HANDOFF 还需要校验交接字段。Adapter 确认有效的 kv_transfer_params 后，D 请求才能按合同构造。" },
      decode: { name: "D 引擎", short: "使用 KV，继续生成", owner: "Decode 执行、序列与设备 KV", body: "HANDOFF 可以等 P 完成之后再选择 D。D 使用交接信息经 Connector 获取或使用 KV，然后生成后续 token。", file: "motor/coordinator/router/strategies/unified_pd.py", symbol: "_ensure_handoff_decode_resource", question: "为什么延后选择 D？", answer: "长 Prefill 期间 D 的负载会变化。延后分配可以参考较新的状态，并让 D 记账窗口贴近实际阶段。" },
      controller: { name: "Controller", short: "实例生命周期与恢复", owner: "实例状态、故障证据与恢复计划", body: "Controller 把节点组织为 Instance，综合心跳和健康推进状态，再发布服务成员。故障后还要协调恢复与幸存者视图。", file: "motor/controller/core/instance_manager.py", symbol: "InstanceManager", question: "Controller 与 Coordinator 的成员状态怎样联系？", answer: "生命周期变化产生观察者事件，EventPusher 同步到 Coordinator Mgmt，再传播到各 Worker。" },
      node: { name: "NodeManager", short: "把指令落实到本地", owner: "原生进程组、本地健康与退役端点", body: "NodeManager 注册本地事实，接收启动和恢复命令，将配置转换为 LaunchSpec，并监督引擎进程。", file: "motor/node_manager/core/services/native_engine/service.py", symbol: "NativeEngineService", question: "普通请求会先经过 NodeManager 吗？", answer: "Coordinator 通过引擎业务端口转发推理。NodeManager 通过管理链路控制这些端口的生命周期。" },
      conductor: { name: "KV Conductor", short: "前缀与缓存位置索引", owner: "模型、租户与 worker 下的覆盖元数据", body: "Rust 服务消费缓存事件，查询连续前缀及分层覆盖，返回给 Coordinator 用于选路。", file: "motor/kv_conductor/src/indexer/mod.rs", symbol: "Indexer / build_response", question: "某个端点拥有相同文本块就能复用吗？", answer: "要检查从根开始的连续前缀与持有关系，下层续接还要保持实例、DP 和 sequence hash 的身份关系。" }
    };
    let path = "request";
    let selected = "coordinator";
    root.innerHTML = head("把同一个系统沿三条路径看一遍", "先切换路径，再点一个组件。观察消息经过哪里，以及状态由谁持有。") +
      '<div class="pm-controls" data-paths></div><div class="pm-stage"><p class="pm-route" data-route></p><div class="pm-topology" data-nodes></div><p class="pm-insight" data-path-detail></p></div><div data-component aria-live="polite"></div>';
    const pathControls = root.querySelector("[data-paths]");
    for (const key of Object.keys(paths)) {
      const button = document.createElement("button");
      button.className = "pm-button";
      button.type = "button";
      button.textContent = paths[key].name;
      button.dataset.path = key;
      button.addEventListener("click", function () {
        path = key;
        if (!paths[path].active.includes(selected)) selected = paths[path].active[0];
        render();
      });
      pathControls.appendChild(button);
    }
    const topology = root.querySelector("[data-nodes]");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const markerId = "pm-topology-arrow-" + (++topologySequence);
    svg.classList.add("pm-topology-svg");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = '<defs><marker id="' + markerId + '" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="var(--pm-accent)"/></marker></defs>';
    topology.appendChild(svg);
    const edges = [
      ["client", "coordinator", "request"], ["coordinator", "client", "request"],
      ["coordinator", "prefill", "request"], ["prefill", "coordinator", "request"],
      ["coordinator", "decode", "request"], ["decode", "coordinator", "request"],
      ["prefill", "decode", "request", "data"],
      ["node", "controller", "control"], ["controller", "node", "control"],
      ["controller", "coordinator", "control"], ["node", "prefill", "control"],
      ["node", "decode", "control"], ["prefill", "conductor", "cache"],
      ["coordinator", "conductor", "cache"], ["conductor", "coordinator", "cache"]
    ];
    const wires = edges.map(function (edge) {
      const wire = document.createElementNS(svg.namespaceURI, "path");
      wire.classList.add("pm-wire");
      wire.dataset.edge = edge[0] + "-" + edge[1];
      wire.dataset.kind = edge[3] || "message";
      wire.setAttribute("fill", "none");
      wire.setAttribute("marker-end", "url(#" + markerId + ")");
      svg.appendChild(wire);
      return wire;
    });
    for (const key of Object.keys(nodes)) {
      const button = document.createElement("button");
      button.className = "pm-node";
      button.type = "button";
      button.dataset.node = key;
      button.innerHTML = '<strong>' + nodes[key].name + '</strong><span>' + nodes[key].short + '</span>';
      button.addEventListener("click", function () { selected = key; render(); });
      topology.appendChild(button);
    }
    function drawWires() {
      const bounds = topology.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      svg.setAttribute("viewBox", "0 0 " + bounds.width + " " + bounds.height);
      const boxes = {};
      topology.querySelectorAll("[data-node]").forEach(function (button) {
        const rect = button.getBoundingClientRect();
        boxes[button.dataset.node] = {
          x: rect.left - bounds.left, y: rect.top - bounds.top,
          right: rect.right - bounds.left, bottom: rect.bottom - bounds.top,
          cx: rect.left - bounds.left + rect.width / 2,
          cy: rect.top - bounds.top + rect.height / 2, height: rect.height
        };
      });
      edges.forEach(function (edge, index) {
        const a = boxes[edge[0]];
        const b = boxes[edge[1]];
        const down = b.cy > a.cy;
        const side = down ? 5 : -5;
        let d;
        if (Math.abs(a.cy - b.cy) < 2) {
          const right = b.cx > a.cx;
          const start = right ? a.right + 3 : a.x - 3;
          const end = right ? b.x - 4 : b.right + 4;
          const lane = right ? -5 : 5;
          d = "M" + start + " " + (a.cy + lane) + " H" + end;
        } else if (Math.abs(a.cy - b.cy) > a.height * 2) {
          const sameColumn = Math.abs(a.cx - b.cx) < 2 || Math.abs(a.x - b.x) < 2;
          const lane = sameColumn ? Math.max(4, a.x - 12 + side / 2) : bounds.width - 5;
          const start = sameColumn ? a.x - 3 : a.right + 3;
          const end = sameColumn ? b.x - 4 : b.right + 4;
          d = "M" + start + " " + a.cy + " H" + lane + " V" + b.cy + " H" + end;
        } else {
          const startY = down ? a.bottom + 3 : a.y - 3;
          const endY = down ? b.y - 4 : b.bottom + 4;
          const midY = (startY + endY) / 2;
          d = "M" + (a.cx + side) + " " + startY + " C" + (a.cx + side) + " " + midY + " " + (b.cx + side) + " " + midY + " " + (b.cx + side) + " " + endY;
        }
        wires[index].setAttribute("d", d);
      });
    }
    const observer = new ResizeObserver(drawWires);
    observer.observe(topology);
    function render() {
      root.querySelector("[data-route]").textContent = paths[path].route;
      root.querySelector("[data-path-detail]").textContent = paths[path].detail;
      pathControls.querySelectorAll("button").forEach(function (button) {
        button.setAttribute("aria-pressed", String(button.dataset.path === path));
      });
      topology.querySelectorAll("button").forEach(function (button) {
        button.dataset.active = String(paths[path].active.includes(button.dataset.node));
        button.setAttribute("aria-pressed", String(button.dataset.node === selected));
      });
      edges.forEach(function (edge, index) {
        wires[index].dataset.active = String(edge[2] === path);
        wires[index].dataset.selected = String(edge[2] === path && (edge[0] === selected || edge[1] === selected));
      });
      const node = nodes[selected];
      root.querySelector("[data-component]").innerHTML = '<h4>' + node.name + '</h4><p>' + node.body + '</p><p class="pm-status">持有状态 · ' + node.owner + '</p><p class="pm-code">' + sourceLink(node.file, node.symbol) + '</p><details class="pm-interview"><summary>试着回答 · ' + node.question + '</summary><p>' + node.answer + '</p></details>';
      requestAnimationFrame(drawWires);
    }
    render();
  }

  function mountStartup(root) {
    const titles = ["配置已准备", "第一个节点注册", "实例组装齐备", "引擎进程启动", "健康确认", "Mgmt 发布成员", "Worker 可选择"];
    const notes = [
      "部署配置决定角色与并行规模，运行中的 Controller 尚未收到这组节点。",
      "第一份 RegisterMsg 建立实例身份，Assembler 继续等待同组节点和端点齐备。",
      "节点齐备后可以组织 master、rank 和端点信息，向各 NM 下发 StartCmd。",
      "NativeEngineService 已将 LaunchSpec 变成进程。健康检查与服务发布还要继续完成。",
      "正常健康事实推动实例进入 ACTIVE，并产生 INSTANCE_READY 观察者事件。",
      "EventPusher 将实例同步到 Mgmt。成员版本和负载槽位已建立，Worker 尚需收到或拉取视图。",
      "Worker 拥有可用成员，后续请求才能选择这些端点并提交负载。"
    ];
    const files = ["motor/config/resolver.py", "motor/node_manager/core/register_manager.py", "motor/controller/core/instance_assembler.py", "motor/node_manager/core/services/native_engine/service.py", "motor/controller/core/instance_manager.py", "motor/controller/core/event_pusher.py", "motor/coordinator/scheduler/runtime/scheduler_client.py"];
    let position = 0;
    let missing = false;
    let unhealthy = false;
    let blocked = "";
    root.innerHTML = head("进程启动以后，为什么仍然接不到请求", "教学拓扑包含两个待组装节点。逐步推进，并改变齐备条件或健康结果。") +
      '<div class="pm-controls"><button class="pm-button" type="button" data-next>下一事件</button><button class="pm-button" type="button" data-reset>回到起点</button><label><input type="checkbox" data-missing> 第二个节点缺席</label><label><input type="checkbox" data-unhealthy> 引擎健康异常</label></div><div class="pm-stage"><div data-steps></div><dl class="pm-facts" data-facts></dl></div><div class="pm-insight" aria-live="polite" data-explanation></div>';
    root.querySelector("[data-next]").addEventListener("click", function () {
      blocked = "";
      if (position === 1 && missing) blocked = "仍停在注册阶段。Assembler 只收到一个节点，当前配置要求两个节点齐备。";
      else if (position === 3 && unhealthy) blocked = "仍停在健康确认之前。进程存在，但健康事实尚不足以把实例发布为可服务目标。";
      else position = Math.min(position + 1, titles.length - 1);
      render();
    });
    root.querySelector("[data-reset]").addEventListener("click", function () { position = 0; blocked = ""; render(); });
    root.querySelector("[data-missing]").addEventListener("change", function (event) {
      missing = event.currentTarget.checked;
      if (missing) position = Math.min(position, 1);
      blocked = "";
      render();
    });
    root.querySelector("[data-unhealthy]").addEventListener("change", function (event) {
      unhealthy = event.currentTarget.checked;
      if (unhealthy) position = Math.min(position, 3);
      blocked = "";
      render();
    });
    function render() {
      const registered = position === 0 ? "0 / 2" : position === 1 ? "1 / 2" : "2 / 2";
      const status = position === 0 ? "尚未创建" : position >= 4 ? "ACTIVE" : "INITIAL";
      root.querySelector("[data-steps]").innerHTML = stepList(titles, position);
      root.querySelector("[data-facts]").innerHTML = fact("已注册节点", registered) + fact("引擎进程", position >= 3 ? "运行中" : "等待启动") + fact("实例状态", status) + fact("Worker 候选", position >= 6 ? "2 个端点" : "0 个端点");
      root.querySelector("[data-explanation]").innerHTML = '<p>' + (blocked || notes[position]) + '</p><p class="pm-code">' + sourceLink(files[position], files[position].split("/").pop()) + '</p><p class="pm-label">演示压缩了异步时间，两个节点的具体齐备规则以实际部署模式为准。</p>';
      root.querySelector("[data-next]").disabled = position === titles.length - 1;
    }
    render();
  }

  function mountRequest(root) {
    const protocols = {
      handoff: {
        titles: ["请求进入", "申请 P", "P 执行", "收到交接票据", "延后申请 D", "D 返回", "清理完成"],
        p: [0, 2048, 2048, 0, 0, 0, 0], d: [0, 0, 0, 0, 6000, 0, 0],
        notes: ["RequestInfo 保存根请求，session 为内部 attempt 建立身份。", "Worker 选择合法 P 端点，CAS 成功后记录本轮提交量。D 尚未分配。", "Adapter 构造 P 请求。P 执行 Prefill，准备可交接的 KV。", "P 返回有效 handoff ticket。此处展示后台 P 释放已经确认的时刻。", "根据当前视图选择兼容 D，将 ticket 注入 D 请求，随后由 Connector 使用 KV。", "D 返回生成结果，提交释放并整理客户端响应。", "等待释放任务完成，回收残余记录，再删除请求上下文。"]
      },
      trigger: {
        titles: ["请求进入", "申请 P/D", "先发 D 请求", "回调触发 P", "引擎协同传输", "D 返回", "清理完成"],
        p: [0, 2048, 2048, 2048, 0, 0, 0], d: [0, 6000, 6000, 6000, 6000, 0, 0],
        notes: ["本轮 attempt 需要在回调时仍可定位，Worker 保存请求上下文。", "为并发协同路径准备兼容的 P/D 资源与能力。", "向 D 发起请求，并给出当前 Worker 的 metaserver 地址。", "D 回调 metaserver，Coordinator 校验 attempt，再触发对应 P 请求。", "引擎与 Connector 协同交接。此处把 P 完成与释放确认合并展示。", "D 返回生成结果，本轮任务进入收尾。", "停止残余任务、确认释放并清理 attempt 与根请求记录。"]
      },
      bootstrap: {
        titles: ["请求进入", "申请 P/D", "准备 bootstrap", "启动 P/D 协同", "KV 就绪", "D 返回", "清理完成"],
        p: [0, 2048, 2048, 2048, 0, 0, 0], d: [0, 6000, 6000, 6000, 6000, 0, 0],
        notes: ["SGLang 原生 PD 适配器选择 bootstrap 协同方式。", "先准备引擎类型和能力相容的 P/D 资源。", "Adapter 写入 bootstrap host、port 和按 attempt 区分的 room。", "P/D 请求按共同 bootstrap 信息协同执行。", "D 等待并使用 P 提供的 KV，此处合并展示 P 完成与释放确认。", "D 生成结束，响应经过客户端格式整理。", "根据本轮记录释放资源，清理请求与 attempt 状态。"]
      }
    };
    let protocol = "handoff";
    let position = 0;
    root.innerHTML = head("沿着一次请求观察 P、D 与账本", "每按一次前进，查看当前阶段、交接信息和本次请求贡献的负载。") +
      '<div class="pm-controls"><label>执行协议 <select data-protocol><option value="handoff">vLLM HANDOFF</option><option value="trigger">vLLM TRIGGER</option><option value="bootstrap">SGLang BOOTSTRAP</option></select></label><button class="pm-button" type="button" data-prev>上一步</button><button class="pm-button" type="button" data-next>下一步</button></div><div class="pm-stage"><div data-steps></div><dl class="pm-facts" data-facts></dl></div><div class="pm-insight" data-explanation aria-live="polite"></div>';
    root.querySelector("[data-protocol]").addEventListener("change", function (event) { protocol = event.currentTarget.value; position = 0; render(); });
    root.querySelector("[data-prev]").addEventListener("click", function () { position = Math.max(0, position - 1); render(); });
    root.querySelector("[data-next]").addEventListener("click", function () { position = Math.min(6, position + 1); render(); });
    function render() {
      const model = protocols[protocol];
      const ticket = protocol === "handoff" ? position >= 3 ? "已获得 ticket" : "等待 P 完成" : protocol === "trigger" ? position >= 3 ? "回调已定位 attempt" : "等待 D 回调" : position >= 2 ? "同一 bootstrap room" : "等待协议参数";
      root.querySelector("[data-steps]").innerHTML = stepList(model.titles, position);
      root.querySelector("[data-facts]").innerHTML = fact("根请求 / 尝试", "R1 / attempt 1") + fact("P 负载增量", model.p[position].toLocaleString("zh-CN")) + fact("D 负载增量", model.d[position].toLocaleString("zh-CN")) + fact("交接状态", position === 6 ? "本轮已结束" : ticket);
      root.querySelector("[data-explanation]").innerHTML = '<p>' + model.notes[position] + '</p><p class="pm-code">' + sourceLink("motor/coordinator/router/strategies/unified_pd.py", "UnifiedPDRouter") + ' · ' + sourceLink("motor/coordinator/router/adapters/pd_protocol.py", "PDProtocolAdapter") + '</p><p class="pm-label">假设输入为 2,048 token，请求体为 6,000 字节。普通 P 记输入长度，普通 D 当前用请求体长度代理。数值为本次请求的模型增量，释放与异步阶段按已确认状态演示。</p>';
      root.querySelector("[data-prev]").disabled = position === 0;
      root.querySelector("[data-next]").disabled = position === 6;
    }
    render();
  }

  window.PyMotorLabs = Object.assign(window.PyMotorLabs || {}, {
    mountOverview: mountOverview,
    mountStartup: mountStartup,
    mountRequest: mountRequest
  });
})();
