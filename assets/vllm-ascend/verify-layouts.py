"""CPU teaching checks for the sequence-parallel article.

Requires NumPy. These checks validate the article's algebra and layouts.
They do not benchmark vLLM, execute HCCL, or validate an Ascend deployment.
"""

import json
import math
import numpy as np


def rmsnorm(x, gamma, eps=1e-6):
    return x / np.sqrt(np.mean(x * x, axis=-1, keepdims=True) + eps) * gamma


def softmax(scores):
    exp = np.exp(scores - np.max(scores, axis=-1, keepdims=True))
    return exp / exp.sum(axis=-1, keepdims=True)


def silu(x):
    return x / (1.0 + np.exp(-x))


def make_weights(seed=42, hidden=8, intermediate=16):
    rng = np.random.default_rng(seed)
    weights = {
        key: rng.normal(0.0, 0.2, (hidden, hidden))
        for key in ("q", "k", "v", "o")
    }
    weights["gate"] = rng.normal(0.0, 0.2, (hidden, intermediate))
    weights["up"] = rng.normal(0.0, 0.2, (hidden, intermediate))
    weights["down"] = rng.normal(0.0, 0.2, (intermediate, hidden))
    weights["norm1"] = rng.uniform(0.8, 1.2, hidden)
    weights["norm2"] = rng.uniform(0.8, 1.2, hidden)
    return weights


def attention_heads(x, weights, head_start=0, head_stop=4, query_positions=None):
    hidden, heads = x.shape[1], 4
    head_dim = hidden // heads
    if query_positions is None:
        query_positions = np.arange(x.shape[0])
    columns = slice(head_start * head_dim, head_stop * head_dim)
    local_heads = head_stop - head_start
    q = (x[query_positions] @ weights["q"][:, columns]).reshape(-1, local_heads, head_dim)
    k = (x @ weights["k"][:, columns]).reshape(-1, local_heads, head_dim)
    v = (x @ weights["v"][:, columns]).reshape(-1, local_heads, head_dim)
    scores = np.einsum("qhd,khd->hqk", q, k) / math.sqrt(head_dim)
    causal = np.arange(x.shape[0])[None, :] <= np.asarray(query_positions)[:, None]
    probabilities = softmax(np.where(causal[None, :, :], scores, -np.inf))
    return np.einsum("hqk,khd->qhd", probabilities, v).reshape(len(query_positions), -1)


def ffn_partial(x, weights, start=0, stop=16):
    activated = silu(x @ weights["gate"][:, start:stop]) * (x @ weights["up"][:, start:stop])
    return activated @ weights["down"][start:stop, :]


def reference_block(x, weights):
    normalized = rmsnorm(x, weights["norm1"])
    residual = x + attention_heads(normalized, weights) @ weights["o"]
    return residual + ffn_partial(rmsnorm(residual, weights["norm2"]), weights)


def tp_block(x, weights):
    normalized = rmsnorm(x, weights["norm1"])
    contributions = [
        attention_heads(normalized, weights, 2 * rank, 2 * rank + 2)
        @ weights["o"][4 * rank:4 * rank + 4, :]
        for rank in range(2)
    ]
    residual = x + sum(contributions)
    normalized = rmsnorm(residual, weights["norm2"])
    return residual + sum(ffn_partial(normalized, weights, 8 * rank, 8 * rank + 8) for rank in range(2))


def pad_rows(x, multiple=2):
    return np.pad(x, ((0, (-x.shape[0]) % multiple), (0, 0)))


def reduce_scatter(contributions):
    return np.split(sum(pad_rows(part) for part in contributions), 2, axis=0)


def dense_sp_block(x, weights):
    local_x = np.split(pad_rows(x), 2, axis=0)
    normalized = np.concatenate([rmsnorm(part, weights["norm1"]) for part in local_x])[:len(x)]
    local_attention = reduce_scatter([
        attention_heads(normalized, weights, 2 * rank, 2 * rank + 2)
        @ weights["o"][4 * rank:4 * rank + 4, :]
        for rank in range(2)
    ])
    residual = [local_x[rank] + local_attention[rank] for rank in range(2)]
    gathered = np.concatenate([rmsnorm(part, weights["norm2"]) for part in residual])
    local_ffn = reduce_scatter([
        ffn_partial(gathered, weights, 8 * rank, 8 * rank + 8)
        for rank in range(2)
    ])
    return np.concatenate([residual[rank] + local_ffn[rank] for rank in range(2)])[:len(x)]


def pcp_block(x, weights):
    # Four tokens and PCP=2: head-tail assignment [A,D] / [B,C].
    normalized = rmsnorm(x, weights["norm1"])
    output = np.empty_like(x)
    for positions in (np.array([0, 3]), np.array([1, 2])):
        attention = attention_heads(normalized, weights, query_positions=positions) @ weights["o"]
        residual = x[positions] + attention
        output[positions] = residual + ffn_partial(rmsnorm(residual, weights["norm2"]), weights)
    return output


def main():
    weights = make_weights()
    rng = np.random.default_rng(20261111)
    report = {"dtype": "float64", "hidden": 8, "heads": 4, "intermediate": 16, "tp": 2, "cases": []}
    for tokens in (1, 4, 5, 9):
        x = rng.normal(size=(tokens, 8))
        expected = reference_block(x, weights)
        tp_error = float(np.max(np.abs(tp_block(x, weights) - expected)))
        sp_error = float(np.max(np.abs(dense_sp_block(x, weights) - expected)))
        assert tp_error < 2e-12 and sp_error < 2e-12
        report["cases"].append({"tokens": tokens, "padded_tokens": len(pad_rows(x)), "tp_error": tp_error, "dense_sp_error": sp_error})
        if tokens == 4:
            pcp_error = float(np.max(np.abs(pcp_block(x, weights) - expected)))
            assert pcp_error < 2e-12
            report["pcp_head_tail_error"] = pcp_error

    parts = [np.arange(32.0).reshape(4, 8), np.arange(32.0, 64.0).reshape(4, 8)]
    assert np.array_equal(np.concatenate(reduce_scatter(parts)), sum(parts))
    norm_input = rng.normal(size=(4, 8))
    split_norm = np.concatenate([rmsnorm(chunk, weights["norm1"]) for chunk in np.split(norm_input, 2)])
    assert np.array_equal(split_norm, rmsnorm(norm_input, weights["norm1"]))

    scores = np.array([0.0, math.log(3.0)])
    values = np.array([2.0, 10.0])
    expected = float(softmax(scores) @ values)
    local_outputs, local_lse = values, scores  # Each shard has one key.
    factors = np.exp(local_lse - np.max(local_lse))
    merged = float(np.sum(factors * local_outputs) / np.sum(factors))
    assert abs(merged - expected) < 1e-12 and abs(merged - 8.0) < 1e-12
    assert float(np.mean(local_outputs)) == 6.0
    report["dcp_merge"] = {"global": expected, "merged": merged, "wrong_unweighted_mean": 6.0}
    report["ffn_linear_flops_per_rank"] = 6 * 4 * 8 * 16 // 2
    report["bf16_4096x4096_mib"] = 4096 * 4096 * 2 // (1024 * 1024)
    report["status"] = "all algebra and layout checks passed; no NPU benchmark performed"
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
