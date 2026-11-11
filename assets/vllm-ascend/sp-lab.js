(function () {
  "use strict";
  const root = document.querySelector("[data-sp-lab]");
  if (!root) return;
  const steps = [
    ["Block 输入", "隐藏状态 X", "complete", true, 8, "token 分片；无通信", "两卡保存相同输入；无通信", "每个本地 token 都保留完整 8 维，权重仍然按 TP 分片。", "两卡都拥有 A/B/C/D，后续分别使用不同权重分片。"],
    ["RMSNorm 1", "归一化后的隐藏状态", "complete", true, 8, "本地计算本卡 token", "两卡分别归一化全部 token", "归一化只用一个 token 自己的 8 个特征，不需要其他 token。", "这里两卡重复计算同样四个 token 的 RMSNorm。"],
    ["准备注意力输入", "归一化后的隐藏状态", "complete", false, 8, "All-gather：收齐 A/B/C/D", "输入已复制；这里没有通信", "收齐的是本轮隐藏状态；残差仍按 A/B 与 C/D 保留。", "普通 TP 本来就拥有全部 token。"],
    ["QKV → RoPE → 因果注意力", "本卡注意力头的输出", "channels", false, 4, "全部 token × 本卡两个头", "全部 token × 本卡两个头", "每卡都处理四个 query，但头不同；这里还没有跨卡合并。", "每卡都处理四个 query，但头不同；注意力输出不是分数矩阵。"],
    ["本卡 o_proj", "注意力输出的部分贡献", "partial", false, 8, "本卡矩阵乘法；尚未求和", "本卡矩阵乘法；尚未求和", "形状回到 [4,8]，但每个值仍只包含本卡注意力头的贡献。", "形状回到 [4,8]，但每个值仍只包含本卡注意力头的贡献。"],
    ["合并 o_proj 的贡献", "完整的注意力输出", "complete", true, 8, "Reduce-scatter：SUM 后按 token 分片", "All-reduce：SUM 后完整复制", "A/B 的求和结果归卡 0，C/D 的求和结果归卡 1。", "两卡都获得 A/B/C/D 的完整求和结果。"],
    ["本地加残差 → RMSNorm 2", "归一化后的 FFN 输入", "complete", true, 8, "本卡 token；无通信", "两卡分别处理全部 token", "本卡注意力输出和本卡残差逐行对齐，然后归一化。", "两卡分别执行同样的残差相加和归一化。"],
    ["准备 FFN 输入", "归一化后的 FFN 输入", "complete", false, 8, "All-gather：再次收齐本轮 token", "输入已复制；这里没有通信", "每个 token 都需要经过两卡各自保存的 FFN 权重分片。", "两卡都已持有全部 token，直接使用本卡权重。"],
    ["gate_proj / up_proj → SwiGLU", "本卡 FFN 中间通道", "channels", false, 8, "全部 token × 8 个本卡通道", "全部 token × 8 个本卡通道", "FFN 总中间维度是 16；每张卡只计算其中 8 个通道。", "FFN 总中间维度是 16；每张卡只计算其中 8 个通道。"],
    ["本卡 down_proj", "FFN 输出的部分贡献", "partial", false, 8, "本卡矩阵乘法；尚未求和", "本卡矩阵乘法；尚未求和", "每卡输出 [4,8]，每个值只有本卡中间通道的贡献。", "每卡输出 [4,8]，每个值只有本卡中间通道的贡献。"],
    ["合并 down_proj 的贡献", "完整的 FFN 输出", "complete", true, 8, "Reduce-scatter：SUM 后按 token 分片", "All-reduce：SUM 后完整复制", "求和后仍按 A/B 与 C/D 分配，每个保留的 token 都是完整 8 维。", "两卡再次获得相同的四个 token 的完整结果。"],
    ["本地加残差 → 下一层", "Block 输出", "complete", true, 8, "继续保持 token 分片", "继续保持两卡复制", "下一层从本卡 token 的 RMSNorm 开始；随后才 all-gather。", "下一层仍从两卡相同的四个 token 开始。"]
  ];
  let mode = "sp";
  let index = 0;
  function rankHtml(rank, step) {
    const tokens = mode === "sp" && step[3] ? (rank === 0 ? ["A", "B"] : ["C", "D"]) : ["A", "B", "C", "D"];
    const rows = tokens.map(function (token) {
      return '<div class="ve-token-row"><span>' + token + '</span><div class="ve-cells">' +
        '<span class="ve-cell" aria-hidden="true"></span>'.repeat(step[4]) + '</div></div>';
    }).join("");
    let channels = "隐藏维 1–8";
    if (step[2] === "partial") channels += " · 部分贡献";
    if (step[2] === "channels") channels = index === 3 ? (rank === 0 ? "头 1–2 · 4 维" : "头 3–4 · 4 维") : (rank === 0 ? "FFN 通道 1–8" : "FFN 通道 9–16");
    const owned = mode === "sp" ? (rank === 0 ? "A/B" : "C/D") : "A/B/C/D";
    return '<div class="ve-rank-head"><strong>卡 ' + rank + ' / rank ' + rank + '</strong><span class="ve-dims">[' + tokens.length + ', ' + step[4] + ']</span></div>' +
      '<div class="ve-rank-label">' + step[1] + ' · ' + channels + '</div>' +
      '<div class="ve-tensor ' + step[2] + '">' + rows + '</div>' +
      '<div class="ve-residual">本卡残差：' + owned + '；隐藏维完整</div>';
  }
  function render() {
    const step = steps[index];
    root.querySelectorAll("[data-sp-mode]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.spMode === mode));
    });
    root.querySelector("[data-sp-prev]").disabled = index === 0;
    root.querySelector("[data-sp-next]").disabled = index === steps.length - 1;
    root.querySelector("[data-sp-count]").textContent = (index + 1) + " / " + steps.length;
    root.querySelector("[data-sp-stage]").textContent = step[0];
    root.querySelector("[data-sp-operation]").textContent = step[mode === "sp" ? 5 : 6];
    root.querySelector("[data-sp-detail]").textContent = step[mode === "sp" ? 7 : 8];
    root.querySelector("[data-sp-rank='0']").innerHTML = rankHtml(0, step);
    root.querySelector("[data-sp-rank='1']").innerHTML = rankHtml(1, step);
    const communicates = (mode === "sp" ? [2, 5, 7, 10] : [5, 10]).includes(index);
    root.querySelector("[data-sp-exchange]").classList.toggle("active", communicates);
  }
  root.querySelectorAll("[data-sp-mode]").forEach(function (button) {
    button.addEventListener("click", function () { mode = button.dataset.spMode; render(); });
  });
  root.querySelector("[data-sp-prev]").addEventListener("click", function () { if (index > 0) { index--; render(); } });
  root.querySelector("[data-sp-next]").addEventListener("click", function () { if (index < steps.length - 1) { index++; render(); } });
  render();
})();
