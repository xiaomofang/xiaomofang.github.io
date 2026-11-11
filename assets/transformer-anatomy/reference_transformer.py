"""教学用、未训练的 NumPy Decoder：RMSNorm + RoPE + GQA + SwiGLU。

运行：python reference_transformer.py
依赖：NumPy。只验证数学/缓存语义；不代表生产内核的布局或性能。
本实现故意使用 float64、显式 attention 和 KV repeat，便于核对。
"""
from __future__ import annotations

import json
from pathlib import Path
import numpy as np


def softmax(x: np.ndarray) -> np.ndarray:
    """沿最后一轴；至少一项有限，禁止全遮罩行。"""
    if not np.all(np.any(np.isfinite(x), axis=-1)):
        raise ValueError("softmax 不接受全遮罩/无有限分数的行")
    z = np.exp(x - x.max(axis=-1, keepdims=True))
    return z / z.sum(axis=-1, keepdims=True)


def rms_norm(x: np.ndarray, gamma: np.ndarray, eps=1e-6) -> np.ndarray:
    return x / np.sqrt(np.mean(x * x, axis=-1, keepdims=True) + eps) * gamma


def silu(x: np.ndarray) -> np.ndarray:
    # 以 exp(-abs(x)) 避免极端输入的指数溢出。
    e = np.exp(-np.abs(x))
    sig = np.where(x >= 0, 1 / (1 + e), e / (1 + e))
    return x * sig


def rope(x: np.ndarray, positions: np.ndarray, base=10000.0) -> np.ndarray:
    """x[B,H,S,dh]；使用相邻通道 (0,1),(2,3)... 配对。"""
    dh = x.shape[-1]
    if dh % 2 or len(positions) != x.shape[-2]:
        raise ValueError("需要偶数 head dim 与匹配的 position 数")
    inv = base ** (-np.arange(0, dh, 2, dtype=np.float64) / dh)
    angle = positions[:, None] * inv[None, :]
    c, s = np.cos(angle)[None, None], np.sin(angle)[None, None]
    a, b = x[..., 0::2], x[..., 1::2]
    out = np.empty_like(x)
    out[..., 0::2] = a * c - b * s
    out[..., 1::2] = a * s + b * c
    return out


def attention(q, k, v, past_len=0):
    """Q[B,Hq,S,dh]、KV[B,Hkv,T,dh]，返回合头前的输出。"""
    hq, hkv = q.shape[1], k.shape[1]
    if hq % hkv:
        raise ValueError("Hq 必须是 Hkv 的整数倍")
    # 仅供数学参考。生产内核应直接共享 KV，而不物化全部重复。
    kr = np.repeat(k, hq // hkv, axis=1)
    vr = np.repeat(v, hq // hkv, axis=1)
    scores = q @ kr.swapaxes(-1, -2) / np.sqrt(q.shape[-1])
    qi = past_len + np.arange(q.shape[-2])
    kj = np.arange(k.shape[-2])
    allow = kj[None, :] <= qi[:, None]
    scores = np.where(allow[None, None], scores, -np.inf)
    return softmax(scores) @ vr


class TinyDecoder:
    def __init__(self, seed=7, vocab=128, d=32, hq=4, hkv=2, layers=2, f=64):
        if d % hq or hq % hkv or (d // hq) % 2:
            raise ValueError("教学配置要求 D%Hq=0、Hq%Hkv=0、dh 为偶数")
        self.d, self.hq, self.hkv = d, hq, hkv
        self.dh = d // hq
        rng = np.random.default_rng(seed)
        def weight(m, n):
            return rng.normal(0, 1 / np.sqrt(m), (m, n))
        self.embed = weight(vocab, d)
        self.blocks = []
        for _ in range(layers):
            self.blocks.append(dict(
                n1=np.ones(d), n2=np.ones(d),
                wq=weight(d, hq * self.dh),
                wk=weight(d, hkv * self.dh),
                wv=weight(d, hkv * self.dh), wo=weight(d, d),
                wg=weight(d, f), wu=weight(d, f), wd=weight(f, d),
            ))
        self.final_norm = np.ones(d)
        self.lm_head = weight(d, vocab)  # 未共享输出权重

    def forward(self, token_ids, caches=None):
        """同 batch、无 padding、连续位置；不支持 ragged/跨请求共享。"""
        x = self.embed[np.asarray(token_ids)]
        if x.ndim != 3 or x.shape[1] == 0:
            raise ValueError("输入须为非空 [B,S] token ID")
        batch, seq, _ = x.shape
        if caches is None:
            caches = [None] * len(self.blocks)
        if len(caches) != len(self.blocks):
            raise ValueError("缓存层数不匹配")
        lengths = [0 if c is None else c[0].shape[-2] for c in caches]
        if len(set(lengths)) != 1:
            raise ValueError("各层历史长度必须一致")
        new_caches = []
        for w, cache, past in zip(self.blocks, caches, lengths):
            n = rms_norm(x, w['n1'])
            def split(z, heads):
                return z.reshape(batch, seq, heads, self.dh).transpose(0, 2, 1, 3)
            q = split(n @ w['wq'], self.hq)
            k = split(n @ w['wk'], self.hkv)
            v = split(n @ w['wv'], self.hkv)
            positions = past + np.arange(seq)
            q, k = rope(q, positions), rope(k, positions)
            if cache is not None:
                old_k, old_v = cache
                expected = (batch, self.hkv, past, self.dh)
                if old_k.shape != expected or old_v.shape != expected:
                    raise ValueError("缓存形状与本次 batch/头数不兼容")
                k = np.concatenate([old_k, k], axis=2)
                v = np.concatenate([old_v, v], axis=2)
            # K 在写入 cache 前已旋转；历史 K 不重复旋转。
            new_caches.append((k, v))
            a = attention(q, k, v, past_len=past)
            a = a.transpose(0, 2, 1, 3).reshape(batch, seq, self.d)
            x = x + a @ w['wo']
            n = rms_norm(x, w['n2'])
            x = x + (silu(n @ w['wg']) * (n @ w['wu'])) @ w['wd']
        logits = rms_norm(x, self.final_norm) @ self.lm_head
        return logits, new_caches


def online_attention(scores, values, block_size=2):
    """单 query 的在线 softmax，values[N,dv]。"""
    m, total = -np.inf, 0.0
    acc = np.zeros(values.shape[-1], dtype=np.float64)
    for start in range(0, len(scores), block_size):
        sb, vb = scores[start:start + block_size], values[start:start + block_size]
        new_m = max(m, sb.max())
        alpha = np.exp(m - new_m)
        p = np.exp(sb - new_m)
        total = alpha * total + p.sum()
        acc = alpha * acc + p @ vb
        m = new_m
    return acc / total


def self_test():
    rng = np.random.default_rng(11)
    ids = rng.integers(0, 128, (2, 11))
    model = TinyDecoder()
    full, full_cache = model.forward(ids)
    errors = {}
    for name, chunks in [('one_token', [1] * 11), ('unequal_chunks', [3, 2, 1, 5])]:
        cache, outputs, start = None, [], 0
        for size in chunks:
            out, cache = model.forward(ids[:, start:start + size], cache)
            outputs.append(out)
            start += size
        actual = np.concatenate(outputs, axis=1)
        np.testing.assert_allclose(actual, full, rtol=1e-10, atol=1e-10)
        errors[name] = float(np.max(np.abs(actual - full)))
        for k, v in cache:
            assert k.shape == v.shape == (2, 2, 11, 8)
    # 改未来 token，不应改变较早位置的 logits。
    changed = ids.copy()
    changed[:, 6:] = (changed[:, 6:] + 17) % 128
    alternative, _ = model.forward(changed)
    np.testing.assert_allclose(full[:, :6], alternative[:, :6], atol=1e-12)
    errors['causal_future_isolation'] = float(np.max(abs(full[:, :6] - alternative[:, :6])))
    # GQA 分组计算应等于显式逐头读取相应 KV。
    q, k, v = (rng.normal(size=s) for s in [(1,4,3,8),(1,2,3,8),(1,2,3,8)])
    grouped = attention(q, k, v)
    headwise = np.concatenate([attention(q[:, i:i+1], k[:, i//2:i//2+1],
                             v[:, i//2:i//2+1]) for i in range(4)], axis=1)
    np.testing.assert_allclose(grouped, headwise, atol=1e-12)
    errors['gqa_head_mapping'] = float(np.max(abs(grouped - headwise)))
    # 旋转保持范数；共同平移位置保持旋转后的匹配内积。
    positions = np.array([0, 5, 10])
    qa, ka = rope(q[:, :2], positions), rope(k, positions)
    qb, kb = rope(q[:, :2], positions + 100), rope(k, positions + 100)
    np.testing.assert_allclose((qa*ka).sum(-1), (qb*kb).sum(-1), atol=1e-11)
    np.testing.assert_allclose((qa*qa).sum(-1), (q[:, :2]**2).sum(-1), atol=1e-11)
    errors['rope_common_shift'] = float(np.max(abs((qa*ka).sum(-1)-(qb*kb).sum(-1))))
    # 在线分块输出与整行 softmax 对齐，覆盖大 logits 与不等长尾块。
    scores, values = rng.normal(size=13) * 20 + 10000, rng.normal(size=(13, 5))
    direct = softmax(scores) @ values
    for block in (1, 2, 5, 13):
        np.testing.assert_allclose(online_attention(scores, values, block), direct,
                                   rtol=1e-12, atol=1e-12)
    errors['online_softmax'] = float(np.max(abs(online_attention(scores, values, 2)-direct)))
    np.testing.assert_allclose(softmax(np.array([1.,2.,3.])),
                               softmax(np.array([1001.,1002.,1003.])), atol=1e-13)
    try:
        softmax(np.array([-np.inf, -np.inf]))
    except ValueError:
        pass
    else:
        raise AssertionError("全遮罩行须被拒绝")
    # 教程容量算例：默认 GQA 为 1 GiB。
    assert 2*32*1*8192*8*128*2 == 2**30
    for cache in full_cache:
        assert cache[0].shape == (2, 2, 11, 8)
    result = dict(status='passed', dtype='float64', numpy_version=np.__version__,
                  checks=['full_vs_token_decode','full_vs_chunked_prefill','cache_shape',
                          'future_isolation','gqa_group_mapping','rope_norm_and_shift',
                          'online_softmax_four_block_sizes','softmax_shift_and_mask',
                          'kv_capacity_formula'], max_absolute_errors=errors,
                  limitations='未训练模型；NumPy 数学参考，未测试 GPU/NPU 性能或低精度内核。')
    Path(__file__).with_name('verification.json').write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    return result


if __name__ == '__main__':
    print(json.dumps(self_test(), ensure_ascii=False, indent=2))
