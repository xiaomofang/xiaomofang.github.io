# 刘梦芳

电话：**** ｜ 邮箱：**** ｜ 北京 ｜ **求职方向：AI Infra / 大模型推理工程师**

## 工作经历

### 天翼云科技有限公司 ｜ 大模型推理 / 算法工程师

**2024.07 - 至今 ｜ 北京**

主要从事大模型推理引擎与 AI Infra 相关研发，负责 Qwen、Llama、DeepSeek、GLM 等系列模型在 NVIDIA / 昇腾平台上的推理服务适配、部署交付与性能优化。基于 vLLM、vLLM-Ascend、MindIE 等推理框架，开展模型量化、投机推理、KV Cache、Prefix Cache、PD 分离和 MoE 大 EP 等推理加速技术研究与工程验证。通过框架代码适配、镜像与工具链建设、profiling 分析和服务参数调优，完成模型精度对齐、性能压测、长稳验证和上线交付。

## 项目经历

### 1. 推理框架与模型适配（天翼云，2024.07 - 至今）

基于 FastAPI、异步任务调度和协程，构建统一推理服务，抽象模型服务启动、模型并行配置、接口调用、性能测试和精度评测流程，支持单机 / 多机部署及 TP / PP 默认、自适应和手动配置，模型上线准备周期缩短约 50%。负责推理框架源码编译、Python 包、基础镜像和运行镜像构建，完成 NVIDIA GPU 与昇腾设备上的服务部署和模型适配；围绕模型配置、权重加载、对话模板和多轮对话流程修改服务代码，完成 Qwen、Llama、DeepSeek 等系列模型的推理适配与交付。

### 2. 推理性能优化、模型量化与 Prefix Cache 验证（天翼云，2025.02 - 至今）

参与 Llama 3.1-8B / 70B 等模型的量化部署、精度评测和性能对比，完成 W8A8 等配置的实验复测，重点分析量化对 TTFT、生成吞吐和数据集精度的影响；在已完成的 Llama 3.1-8B 实验中，昇腾平台 TTFT 降低约 20%~25%、生成吞吐提升约 10%~25%，NVIDIA 平台吞吐提升约 20%，精度偏差主要控制在 1% 左右，同时跟进高并发场景下量化收益不稳定、精度退化和多卡运行异常等问题。另完成 Prefix Cache 在长文本、多轮对话和高并发场景下的功能与性能验证，定位 Qwen2-7B 缓存开启后的精度异常并完成修复；结合 vLLM / MindIE profiling 分析算子耗时、通信开销和服务参数，定位不同模型与并行配置下的性能瓶颈。

### 3. EAGLE / EAGLE3 投机推理适配与性能验证（天翼云，2025.05 - 2025.09）

面向 Qwen、Llama 等系列模型完成 EAGLE / EAGLE3 draft model 训练数据生成、模型训练、结构适配、离线推理和在线服务验证，建立从草稿模型训练到在线加速评估的验证流程；针对 Qwen3 重写 EAGLE `cnets.py` 等模型结构代码，修复 `head_dim` 与注意力头配置不一致导致的维度错误，并补充 safetensors 权重加载逻辑。Llama2-7B 离线推理吞吐由约 22.8 tokens/s 提升至 75.6 tokens/s，Qwen3-8B 在线验证中中文数据集加速比约 1.8~2.0×、英文数据集约 2.4×；通过对比投机层数、Top-K、Attention Backend 和并发度，分析接受率、草稿计算开销与端到端收益之间的关系。

### 4. MoE 大模型大 EP 部署与性能调优（天翼云，2026.02 - 至今）

围绕 MoE 大模型多机推理，基于 Pymotor 完成大 EP 服务部署、集群配置和性能调优，调整 EP / TP / DP、EPLB、PD 配比、MTP 及长上下文参数，并结合 profiling 定位 MoE 通信、HCCL 和任务调度开销；同时结合 Mooncake、LMCache 等方案学习 KV Cache 池化、Prefill / Decode 分离与缓存调度机制。在 GLM-5.2 W4A8 2P2D 场景中，16K 输入下 TTFT 由 15.702s 降至 3.569s。

## 专业技能

**推理框架：** vLLM、vLLM-Ascend、MindIE、SGLang ｜ **推理优化：** PagedAttention、Continuous Batching、Prefix Cache、Chunked Prefill、KV Cache、PD 分离、MTP / EAGLE、MoE / EP
**模型压缩：** W8A8、W4A8、GPTQ、SmoothQuant、校准集构建与精度对齐 ｜ **工程与性能：** Python、C++、PyTorch、FastAPI、Docker、Kubernetes、Linux、CUDA、NCCL、HCCL、MindStudio Profiling

## 教育经历

**清华大学 ｜ 电子信息 ｜ 硕士 ｜ 3.86 / 4.0 ｜ 2021.09 - 2024.06**
**武汉大学 ｜ 测控技术与仪器 ｜ 学士 ｜ 3.7 / 4.0 ｜ 2017.09 - 2021.06**

## 奖项与证书

清华大学校级综合优秀二等奖学金、中图仪器综合奖学金、国家励志奖学金、CET-6
