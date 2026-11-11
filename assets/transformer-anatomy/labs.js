"use strict";
const labSpecs = {
    architecture: { title: '结构实验 · 沿信息流走一遍', defaults: { variant: 'modern', stage: 0 }, controls: [{ key: 'variant', label: '架构', kind: 'select', options: [['modern', '现代 Decoder 示例'], ['original', '原版 Encoder–Decoder']] }, { key: 'stage', label: '当前加工阶段', kind: 'range', min: 0, max: 5, step: 1 }], caption: '结构示意；原版省略 dropout，现代路径选择 Pre-RMSNorm / RoPE / GQA / SwiGLU。' },
    attention: { title: '注意力实验 · 改变查询，观察内容混合', defaults: { qx: 1, qy: 1, temp: 1, position: 2, causal: false }, controls: [{ key: 'qx', label: 'Query 的第 1 维', kind: 'range', min: -2, max: 2, step: .1 }, { key: 'qy', label: 'Query 的第 2 维', kind: 'range', min: -2, max: 2, step: .1 }, { key: 'temp', label: '教学温度 τ', kind: 'range', min: .25, max: 2, step: .05 }, { key: 'position', label: 'Query 的序列位置', kind: 'select', options: [[0, '位置 0'], [1, '位置 1'], [2, '位置 2']] }, { key: 'causal', label: '使用因果遮罩', kind: 'check' }], caption: '独立教学数据：K=[(1,0),(0,1),(1,1)]；V=[(1,0),(0,2),(3,1)]。分数除以 √2，再除教学温度。' },
    rope: { title: 'RoPE 实验 · 同时平移，相对关系不变', defaults: { m: 2, n: 5, shift: 0 }, controls: [{ key: 'm', label: 'Query 位置 m', kind: 'range', min: 0, max: 12, step: 1 }, { key: 'n', label: 'Key 位置 n', kind: 'range', min: 0, max: 12, step: 1 }, { key: 'shift', label: '共同位置平移 Δ', kind: 'range', min: 0, max: 20, step: 1 }], caption: '只展示一个二维平面，θ=0.35 rad/位置。内容 q=(1,0)，k=(cos0.6,sin0.6) 固定。' },
    activation: { title: '函数实验 · 负输入会被怎样处理？', defaults: { fn: 'silu', x: 1 }, controls: [{ key: 'fn', label: '激活函数', kind: 'select', options: [['relu', 'ReLU'], ['gelu', 'GELU（tanh 近似）'], ['silu', 'SiLU'], ['sigmoid', 'Sigmoid']] }, { key: 'x', label: '输入 x', kind: 'range', min: -4, max: 4, step: .05 }], caption: '横轴为输入 x，纵轴为函数值，均无量纲。GELU 使用正文给出的常见 tanh 近似。' },
    cacheStep: { title: '缓存实验 · 已采样，不等于已写入缓存', defaults: { step: 0 }, controls: [{ key: 'step', label: '生成进度', kind: 'select', options: [[0, 'Prompt prefill 后'], [1, '第 1 次 decode 后'], [2, '第 2 次 decode 后']] }], caption: '玩具 token 与预定输出，不是运行语言模型。展示两层缓存，每一层都有独立 K/V。采样到 EOS 后通常停止。' },
    kv: { title: 'KV 容量实验 · 比较 MHA、GQA 与 MQA', defaults: { layers: 32, batch: 1, tokens: 8192, heads: 8, bytes: 2 }, controls: [{ key: 'layers', label: '层数 L', kind: 'select', options: [[16, '16 层'], [32, '32 层'], [80, '80 层']] }, { key: 'batch', label: '序列数量 B', kind: 'range', min: 1, max: 16, step: 1 }, { key: 'tokens', label: '每条序列 token 数 T', kind: 'range', min: 512, max: 32768, step: 512 }, { key: 'heads', label: 'KV 头数 Hkv', kind: 'select', options: [[32, '32 · MHA'], [8, '8 · GQA'], [1, '1 · MQA']] }, { key: 'bytes', label: '每元素字节 b', kind: 'select', options: [[2, '2 字节 · BF16/FP16 载荷'], [1, '1 字节 · 8 bit 载荷']] }], caption: '固定 Hq=32、dh=128。只算元素载荷，不含页尾、比例因子、对齐与元数据；不是每卡分片估算。' },
    flash: { title: '在线 softmax 实验 · 分母怎样跨块保留？', defaults: { step: 1 }, controls: [{ key: 'step', label: '已处理的数据块', kind: 'select', options: [[0, '初始状态'], [1, '块 1：分数 2、1'], [2, '块 1 + 块 2：再读 3、0']] }], caption: '单 query、标量 value。分数 [2,1,3,0]，value [1,2,−1,4]；每块 2 项。全部数值现场计算。' },
    pages: { title: '分页实验 · 逻辑连续，物理块可以不连续', defaults: { tokens: 9 }, controls: [{ key: 'tokens', label: '请求包含的 token 数', kind: 'range', min: 1, max: 20, step: 1 }], caption: '教学块容量为 4 token；预设物理块顺序 [7,2,11,4,9]。空槽表示真实尾部内部碎片。' },
    moe: { title: 'MoE 路由实验 · 少数路径与负载倾斜', defaults: { k: 2, bias: 0, token: 0 }, controls: [{ key: 'k', label: '每 token 激活专家数', kind: 'select', options: [[1, 'Top-1'], [2, 'Top-2']] }, { key: 'bias', label: '专家 0 的教学路由偏置', kind: 'range', min: -2, max: 4, step: .25 }, { key: 'token', label: '查看一枚 token 的路径', kind: 'select', options: Array.from({ length: 8 }, (_, i) => [i, `token ${i}`]) }], caption: '8 枚教学 token、4 位专家；选中后归一化。偏置只用于显示热点，不代表某个模型的完整负载均衡算法。' },
    roofline: { title: 'Roofline 实验 · 同一权重服务更多输入行', defaults: { batch: 1 }, controls: [{ key: 'batch', label: 'Linear 输入行数 B', kind: 'range', min: 1, max: 128, step: 1 }], caption: '教学设备：200 TFLOP/s、2 TB/s；D=4096、2 字节元素。权重一次读取，输入输出各一次；理论上界，非实测。' }
};
const numberOf = (s, k) => Number(s[k]);
const f = (x, d = 3) => Number.isFinite(x) ? x.toFixed(d) : (x < 0 ? '−∞' : '∞');
const prettyBytes = (b) => b >= 2 ** 30 ? `${f(b / 2 ** 30, 3)} GiB` : b >= 2 ** 20 ? `${f(b / 2 ** 20, 2)} MiB` : `${f(b / 1024, 1)} KiB`;
function stableSoftmax(scores) { const m = Math.max(...scores); const e = scores.map(x => Math.exp(x - m)); const total = e.reduce((a, b) => a + b, 0); return e.map(x => x / total); }
function svgFrame(title, body, height = 240) { return `<svg class="lab-plot" viewBox="0 0 280 ${height}" role="img" aria-label="${title}"><title>${title}</title>${body}</svg>`; }
function vectorLine(x, y, label, accent = false, angleOrigin = false) {
    const ox = 140, oy = 120, scale = 46, px = ox + x * scale, py = oy - y * scale;
    return `<line x1="${ox}" y1="${oy}" x2="${px}" y2="${py}" stroke="${accent ? 'var(--viz)' : 'var(--secondary-ink)'}" stroke-width="${accent ? 3 : 1.5}"/><circle cx="${px}" cy="${py}" r="${accent ? 4 : 3}" fill="${accent ? 'var(--viz)' : 'var(--secondary-ink)'}"/><text x="${Math.max(14, Math.min(228, px + 8))}" y="${Math.max(20, Math.min(225, py + (angleOrigin ? 18 : -8)))}" fill="var(--ink)">${label}</text>`;
}
function axes() { return '<line x1="18" y1="120" x2="262" y2="120" stroke="var(--line)"/><line x1="140" y1="15" x2="140" y2="225" stroke="var(--line)"/><text x="258" y="140">x</text><text x="148" y="20">y</text><text x="145" y="137">0</text>'; }
function renderLab(id, s) {
    if (id === 'architecture') {
        const modern = s.variant === 'modern', stage = numberOf(s, 'stage');
        const stages = modern ? ['Token IDs → Embedding', 'RMSNorm → Q/K/V + RoPE', 'Causal GQA → WO', '残差相加', 'RMSNorm → SwiGLU → 残差', '重复 L 层 → Final Norm → Logits'] : ['源句 → Embedding + 位置', 'Encoder：Self-Attention + Add/Norm', 'Encoder：FFN + Add/Norm', '目标前缀 → Masked Self-Attention', 'Cross-Attention：Q 来自目标，KV 来自源', 'FFN → 堆叠 → 输出词表分数'];
        const notes = modern ? ['ID 查表，得到 [B,S,D]。', 'Q/K 构造带位置的匹配；V 保留内容。', '每个 Q 头检索可见的 KV，合头后回到 D。', '原表示与 attention 修正相加。', '相同位置的通道进行门控非线性加工。', '末尾位置的词表分数用于选择下一 token。'] : ['源语言是已知条件。', '源句位置间交换信息，通常可双向关注。', '源句每个位置使用同层共享的 FFN。', '目标 self-attention 只能看已知目标前缀。', '编码后的源句给 Decoder 提供可查询内容。', 'Decoder 自回归地产生目标序列。'];
        return `<div class="architecture-flow">${stages.map((t, i) => `<div class="arch-node ${i === stage ? 'active' : ''}"><span class="node-index">${i + 1}</span><span>${t}</span></div>`).join('')}</div><p class="lab-detail" aria-live="polite">阶段 ${stage + 1} / 6 · ${notes[stage]}</p>`;
    }
    if (id === 'attention') {
        const qx = numberOf(s, 'qx'), qy = numberOf(s, 'qy'), temp = numberOf(s, 'temp'), pos = numberOf(s, 'position');
        const raw = [qx, qy, qx + qy], logits = raw.map((x, i) => s.causal && i > pos ? -Infinity : x / Math.sqrt(2) / temp), a = stableSoftmax(logits), out = [a[0] + 3 * a[2], 2 * a[1] + a[2]];
        return `<div class="lab-split"><div><h4>Q / K 的二维坐标（无量纲）</h4>${svgFrame('Query 与三枚 Key 的二维向量', axes() + vectorLine(1, 0, 'K₁') + vectorLine(0, 1, 'K₂') + vectorLine(1, 1, 'K₃') + vectorLine(qx, qy, 'Q', true, true))}<div class="legend"><span class="swatch"></span>Q：当前查询 <span class="swatch muted"></span>K：候选索引</div></div><div><h4>沿 key 轴归一化的权重</h4><table class="lab-table"><thead><tr><th>Key</th><th>点积</th><th>权重</th></tr></thead><tbody>${a.map((w, i) => `<tr><td>K${i + 1}${logits[i] === -Infinity ? ' · 遮住' : ''}</td><td>${f(raw[i], 2)}</td><td><b>${f(w * 100, 2)}%</b><div class="bar-track"><div style="width:${w * 100}%" class="bar-fill"></div></div></td></tr>`).join('')}</tbody></table><div class="lab-result" aria-live="polite">输出 z = [${f(out[0], 4)}, ${f(out[1], 4)}]</div><p class="lab-detail">最大权重位置：K${a.indexOf(Math.max(...a)) + 1}；权重和 ${f(a.reduce((p, c) => p + c, 0), 4)}</p></div></div>`;
    }
    if (id === 'rope') {
        const m = numberOf(s, 'm'), n = numberOf(s, 'n'), shift = numberOf(s, 'shift'), qa = (m + shift) * .35, ka = (n + shift) * .35 + .6, dot = Math.cos(ka - qa);
        return `<div class="lab-split"><div>${svgFrame('固定内容向量经位置旋转后的 Q 和 K', axes() + '<circle cx="140" cy="120" r="46" fill="none" stroke="var(--line)"/>' + vectorLine(Math.cos(qa), Math.sin(qa), 'Q′', true) + vectorLine(Math.cos(ka), Math.sin(ka), 'K′', false, true))}<div class="legend"><span class="swatch"></span>旋转后 Q <span class="swatch muted"></span>旋转后 K</div></div><div><h4>相对位置与内积</h4><dl class="lab-numbers"><div><dt>实际位置 (m+Δ, n+Δ)</dt><dd>(${m + shift}, ${n + shift})</dd></div><div><dt>位置差 n−m</dt><dd>${n - m}</dd></div><div><dt>旋转后点积（无量纲）</dt><dd>${f(dot, 6)}</dd></div></dl><p class="lab-detail" aria-live="polite">只改共同平移 Δ，点积仍为 ${f(Math.cos((n - m) * .35 + .6), 6)}。</p></div></div>`;
    }
    if (id === 'activation') {
        const fn = String(s.fn), x = numberOf(s, 'x');
        const funcs = { relu: v => Math.max(0, v), gelu: v => .5 * v * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (v + .044715 * v ** 3))), silu: v => v / (1 + Math.exp(-v)), sigmoid: v => 1 / (1 + Math.exp(-v)) };
        const names = { relu: 'ReLU', gelu: 'GELU（近似）', silu: 'SiLU', sigmoid: 'Sigmoid' };
        const X = (v) => 32 + (v + 4) * 27, Y = (v) => 190 - (v + 1) * 33;
        const path = Array.from({ length: 161 }, (_, i) => { const v = -4 + i * .05; return `${i ? 'L' : 'M'}${X(v).toFixed(2)},${Y(funcs[fn](v)).toFixed(2)}`; }).join(' ');
        const plot = `<line x1="25" y1="${Y(0)}" x2="260" y2="${Y(0)}" stroke="var(--line)"/><line x1="${X(0)}" y1="20" x2="${X(0)}" y2="200" stroke="var(--line)"/><text x="25" y="218">−4</text><text x="${X(0) - 3}" y="218">0</text><text x="243" y="218">4</text><text x="8" y="${Y(4) + 4}">4</text><text x="8" y="${Y(0) + 4}">0</text><text x="185" y="237">输入 x</text><path d="${path}" fill="none" stroke="var(--viz)" stroke-width="2.5"/><circle cx="${X(x)}" cy="${Y(funcs[fn](x))}" r="4.5" fill="var(--viz)"/>`;
        return `<div class="lab-split"><div><h4>函数值 f(x)（无量纲）</h4>${svgFrame(names[fn] + ' 函数曲线，横轴输入 x，纵轴函数值', plot, 245)}</div><div><h4>${names[fn]}</h4><dl class="lab-numbers"><div><dt>输入 x</dt><dd>${f(x, 2)}</dd></div><div><dt>输出 f(x)</dt><dd>${f(funcs[fn](x), 5)}</dd></div></dl><p class="lab-detail" aria-live="polite">${fn === 'relu' ? '负输入归零；正输入原样通过。' : fn === 'sigmoid' ? '输出在 0 与 1 之间；各元素不要求和为 1。' : '小幅负输出被保留；这不是硬切断的开关。'}</p></div></div>`;
    }
    if (id === 'cacheStep') {
        const step = numberOf(s, 'step'), all = ['我', '爱', '数', '学', '。'], cached = all.slice(0, 3 + step), pred = ['学', '。', '〈结束〉'][step];
        return `<div class="cache-rows">${[1, 2].map(l => `<div class="cache-row"><span>第 ${l} 层<br>K + V</span><div class="token-row">${cached.map((t, i) => `<span class="token-cell ${i === cached.length - 1 ? 'latest' : ''}">${t}<small>p=${i}</small></span>`).join('')}</div></div>`).join('')}</div><dl class="lab-numbers horizontal"><div><dt>每层缓存长度</dt><dd>${cached.length}</dd></div><div><dt>本轮已采样，尚未写入</dt><dd>${pred}</dd></div></dl><p class="lab-detail" aria-live="polite">${step === 0 ? 'Prompt 的末尾 logits 产生“学”；无需再做一轮空计算。' : step === 1 ? '把“学”送入网络后，p=3 的 K/V 才追加，随后采样“。”。' : '把“。”送入网络后追加 p=4；采样到结束标记，生成停止。'}</p>`;
    }
    if (id === 'kv') {
        const L = numberOf(s, 'layers'), B = numberOf(s, 'batch'), T = numberOf(s, 'tokens'), h = numberOf(s, 'heads'), b = numberOf(s, 'bytes'), payload = (heads) => 2 * L * B * T * heads * 128 * b;
        return `<div class="lab-result" aria-live="polite">当前缓存载荷：${prettyBytes(payload(h))}</div><p class="lab-detail">每 token（跨 L 层）：${prettyBytes(2 * L * h * 128 * b)}；${B} 条 × ${T.toLocaleString('en-US')} token</p><h4>同一 L / B / T / dtype 下的载荷比较</h4><div class="compare-bars">${[[32, 'MHA'], [8, 'GQA'], [1, 'MQA']].map(([heads, name]) => `<div class="compare-row"><span>${name}<small>${heads} KV 头</small></span><div class="bar-track"><div class="bar-fill ${Number(heads) === h ? '' : 'quiet'}" style="width:${Number(heads) / 32 * 100}%"></div></div><b>${prettyBytes(payload(Number(heads)))}</b></div>`).join('')}</div><p class="axis-caption">条长：缓存载荷（字节），MHA 为当前比较上限。</p>`;
    }
    if (id === 'flash') {
        const step = numberOf(s, 'step'), scores = [2, 1, 3, 0], values = [1, 2, -1, 4];
        let m = -Infinity, l = 0, u = 0;
        for (let start = 0; start < step * 2; start += 2) {
            const nm = Math.max(m, ...scores.slice(start, start + 2)), alpha = Math.exp(m - nm), p = scores.slice(start, start + 2).map(v => Math.exp(v - nm));
            u = alpha * u + p[0] * values[start] + p[1] * values[start + 1];
            l = alpha * l + p[0] + p[1];
            m = nm;
        }
        const full = stableSoftmax(scores).reduce((acc, p, i) => acc + p * values[i], 0);
        return `<div class="chunk-grid">${[0, 1].map(i => `<div class="chunk ${i < step ? 'processed' : ''}"><h4>块 ${i + 1} · ${i < step ? '已读入' : '未读入'}</h4><p>分数 [${scores.slice(i * 2, i * 2 + 2).join(', ')}]</p><p>Value [${values.slice(i * 2, i * 2 + 2).join(', ')}]</p></div>`).join('')}</div><dl class="lab-numbers horizontal"><div><dt>累计最大值 m</dt><dd>${f(m, 3)}</dd></div><div><dt>累计指数和 ℓ</dt><dd>${f(l, 6)}</dd></div><div><dt>累计内容 u</dt><dd>${f(u, 6)}</dd></div></dl><div class="lab-result" aria-live="polite">${step ? `已读部分输出 u/ℓ = ${f(u / l, 6)}` : '初始状态：等待第 1 块'}</div><p class="lab-detail">整行 softmax 参考：${f(full, 6)}${step === 2 ? `；分块与整行差异 ${Math.abs(u / l - full).toExponential(2)}` : '；处理完两块后再比较。'}</p>`;
    }
    if (id === 'pages') {
        const T = numberOf(s, 'tokens'), allocated = Math.ceil(T / 4), phys = [7, 2, 11, 4, 9];
        return `<div class="page-list">${phys.slice(0, allocated).map((p, i) => `<div class="page-row"><span>逻辑块 ${i}<br><small>物理块 ${p}</small></span><div class="page-slots">${Array.from({ length: 4 }, (_, j) => `<span class="page-slot ${4 * i + j < T ? 'occupied' : ''}">${4 * i + j < T ? 't' + (4 * i + j) : '空'}</span>`).join('')}</div></div>`).join('')}</div><p class="lab-detail" aria-live="polite">${T} 枚 token → ${allocated} 块 → ${allocated * 4} 槽位；尾部空 ${allocated * 4 - T} 槽。块表：[${phys.slice(0, allocated).join(', ')}]</p>`;
    }
    if (id === 'moe') {
        const k = numberOf(s, 'k'), bias = numberOf(s, 'bias'), token = numberOf(s, 'token');
        const logits = [[2, 1, 0, -1], [1, 2, 0, -1], [0, 1, 2, -1], [0, -1, 1, 2], [1.5, 1, 0, -1], [-1, 0, 2, 1], [0, 1, -1, 2], [1, 1.2, .2, -.5]].map(r => r.map((v, i) => v + (i === 0 ? bias : 0)));
        const choices = logits.map(row => row.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v || a.i - b.i).slice(0, k));
        const counts = [0, 0, 0, 0];
        choices.forEach(row => row.forEach(c => counts[c.i]++));
        const selected = choices[token], weights = stableSoftmax(selected.map(c => c.v)), expertValues = [2, -1, 3, .5], out = selected.reduce((a, c, i) => a + weights[i] * expertValues[c.i], 0);
        return `<h4>Token ${token} 的分派与合并（某一输出通道）</h4><div class="route-line"><span>完整 token 向量</span><span>Router → ${selected.map((c, i) => `专家 ${c.i}（${f(weights[i] * 100, 1)}%）`).join(' + ')}</span></div><div class="lab-result" aria-live="polite">输出通道 = ${f(out, 4)}</div><p class="lab-detail">专家输出示意 [2, −1, 3, 0.5]；本 token 路由 logits [${logits[token].map(v => f(v, 2)).join(', ')}]</p><h4>整个教学 batch 的专家分派数</h4><div class="compare-bars">${counts.map((c, i) => `<div class="compare-row"><span>专家 ${i}</span><div class="bar-track"><div class="bar-fill ${selected.some(x => x.i === i) ? '' : 'quiet'}" style="width:${c / 8 * 100}%"></div></div><b>${c} 次</b></div>`).join('')}</div><p class="axis-caption">条长：分派次数（0—8）；总分派 ${counts.reduce((a, b) => a + b, 0)} = 8 token × ${k}。</p>`;
    }
    if (id === 'roofline') {
        const B = numberOf(s, 'batch'), D = 4096, flops = 2 * B * D * D, bytes = 2 * (D * D + 2 * B * D), I = flops / bytes, bound = Math.min(200, 2 * I);
        const X = (v) => 35 + Math.log2(v) / 8 * 220, Y = (v) => 195 - Math.log2(v) / 8 * 160;
        const path = Array.from({ length: 129 }, (_, i) => { const iv = 2 ** (i / 16); return `${i ? 'L' : 'M'}${X(iv)},${Y(Math.min(200, 2 * iv))}`; }).join(' ');
        const plot = `<line x1="35" y1="195" x2="260" y2="195" stroke="var(--line)"/><line x1="35" y1="25" x2="35" y2="195" stroke="var(--line)"/><path d="${path}" fill="none" stroke="var(--secondary-ink)" stroke-width="2"/><circle cx="${X(Math.max(1, I))}" cy="${Y(bound)}" r="5" fill="var(--viz)"/><text x="31" y="215">1</text><text x="140" y="215">16</text><text x="237" y="215">256</text><text x="9" y="${Y(2) + 5}">2</text><text x="1" y="${Y(32) + 5}">32</text><text x="1" y="${Y(200) + 5}">200</text>`;
        return `<div class="lab-split"><div><h4>理论吞吐上界（TFLOP/s）</h4>${svgFrame('Roofline：横轴算术强度 FLOP/Byte，纵轴理论吞吐 TFLOP/s', plot, 225)}<p class="axis-caption">横轴：算术强度 I（FLOP/Byte，对数刻度）</p></div><div><dl class="lab-numbers"><div><dt>本 Linear 算术强度</dt><dd>${f(I, 2)} FLOP/Byte</dd></div><div><dt>理论上界</dt><dd>${f(bound, 2)} TFLOP/s</dd></div><div><dt>转折强度 P/BW</dt><dd>100 FLOP/Byte</dd></div></dl><p class="lab-detail" aria-live="polite">当前${I < 100 ? '带宽给出的上界更低' : '算力给出的上界更低'}。实际执行还会受形状、启动和同步影响。</p></div></div>`;
    }
    return '';
}

// Keep the site's 840-unit drawing convention while preserving the teaching geometry.
function svgFrame(title, body, height=240) {
  const painted=body.replace(/\b(fill|stroke)="var\(--([a-z-]+)\)"/g,(_,kind,token)=>`class="tf-${kind}-${token}"`);
  return `<svg class="lab-plot" viewBox="0 0 840 ${height*3}" role="img" aria-label="${title}"><title>${title}</title><g transform="scale(3)">${painted}</g></svg>`;
}
// Preserve a readable text boundary between a label and its block-level note.
const tfBaseRenderLab=renderLab;
renderLab=function(id,state){return tfBaseRenderLab(id,state).replace(/<small>/g,' <small>');};

(() => {
 const states={};
 document.querySelectorAll('[data-lab]').forEach(mount=>{
   const id=mount.dataset.lab,spec=labSpecs[id],state={...spec.defaults};states[id]=state;
   mount.addEventListener('input',event=>{
     const target=event.target,key=target.dataset.key;if(!key)return;
     const control=spec.controls.find(c=>c.key===key);if(!control)return;
     state[key]=control.kind==='check'?target.checked:control.kind==='range'?Number(target.value):target.value;
     const output=mount.querySelector(`[data-value="${key}"]`);if(output)output.textContent=String(state[key]);
     mount.querySelector('.lab-stage').innerHTML=renderLab(id,state);
   });
 });
 window.TransformerLabs={specs:labSpecs,render:renderLab,states};
 const toc=document.querySelector('.tf-rail details'),mobile=matchMedia('(max-width:1000px)');
 toc.open=!mobile.matches;mobile.addEventListener('change',()=>{toc.open=!mobile.matches;});
 const sections=Array.from(document.querySelectorAll('.tf-chapter,.transformer-article .references-section'));
 let pending=false;
 function updateToc(){let active=sections[0];for(const section of sections){if(section.getBoundingClientRect().top<=160)active=section;else break;}document.querySelectorAll('[data-toc]').forEach(a=>{if(a.dataset.toc===active.id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});pending=false;}
 addEventListener('scroll',()=>{if(!pending){pending=true;requestAnimationFrame(updateToc);}},{passive:true});
 document.querySelectorAll('[data-toc]').forEach(a=>a.addEventListener('click',()=>{if(mobile.matches)toc.open=false;}));
 updateToc();
})();
