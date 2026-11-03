# 容器 & Kubernetes 速查表（LLM 推理部署版）

> 配套文章：[大模型部署的容器与 Kubernetes：算法工程师必须知道的部分](../posts/basic/containers-kubernetes-llm-deployment.html)
>
> 约定：`<ns>` 命名空间，`<pod>` Pod 名，`<dep>` Deployment 名，`<svc>` Service 名，`<crd>` CRD 名。
> 所有命令都按「先看状态 → 再看事件 → 最后看对象 YAML」的顺序排过，照着敲即可。

---

## 0. 三句话定位问题

| 症状 | 大概率层级 | 第一命令 |
|---|---|---|
| Pod 一直 Pending | 调度 / 存储绑定 | `kubectl describe pod` 看 Events |
| Pod 反复重启 | 容器内进程 | `kubectl logs -p` 看上次日志 |
| Pod Running 但请求失败 | Service / 探针 | `kubectl get endpointslices` |
| 改了配置没生效 | ConfigMap / 进程未重读 | `kubectl exec` 看文件 + 重启进程 |
| CR 建了不推进 | CRD / Controller | `kubectl describe <crd>` + 看平台 Pod |

---

## 1. 容器层（Docker / Podman）

```bash
docker build -t app:0.1 .                 # 构建镜像
docker images | head                      # 本地镜像
docker run -it --rm app:0.1 bash          # 起一个临时容器
docker run -d -p 8000:8000 --name api app:0.1
docker run --rm -v /data02:/data app:0.1 ls /data      # bind mount，等价 K8s volumeMount
docker run --rm --cpus=2 --memory=4g app:0.1 nproc     # 配额不改变 nproc 的视野
docker logs -f api
docker exec -it api bash
docker inspect api | head -50
docker stats
docker save app:0.1 | gzip > app.tgz      # 离线搬运镜像
docker push registry.local/team/app:0.1
```

要点：

- `--cpus` 是 CFS 配额，`/proc/cpuinfo`、`os.cpu_count()` 仍显示宿主核数；要真隔离用 `--cpuset-cpus`。
- 容器内 `PID 1` 是 `CMD`/`ENTRYPOINT`；写 `CMD ["bash","-c","..."]` 时注意信号是否被正确转发。
- 镜像里不要存密钥；用挂载或 Secret 注入。

---

## 1.5 容器账本速查（cgroup v2）

```bash
cat /sys/fs/cgroup/cpu.max            # quota period，如 160000 100000
cat /sys/fs/cgroup/cpu.stat           # nr_throttled / throttled_usec 累计节流
cat /sys/fs/cgroup/memory.current     # 已用（含 page cache 与 tmpfs）
cat /sys/fs/cgroup/memory.stat        # anon / file / slab 拆分
cat /sys/fs/cgroup/memory.events      # oom / oom_kill 计数
cat /sys/fs/cgroup/memory.peak        # 峰值，查偶发 OOM 最有用的一个数
cat /sys/fs/cgroup/pids.current ; cat /sys/fs/cgroup/pids.max
df -h /dev/shm                        # 默认 64MB，大 batch 常崩在这
ulimit -a                             # 关注 nofile（连接）与 memlock（RDMA）
nproc ; python -c "import os; print(os.cpu_count(), len(os.sched_getaffinity(0)))"
ls /dev/davinci* /dev/davinci_manager /dev/devmm_svm 2>/dev/null
```

| 看到什么 | 说明什么 | 接下来 |
|---|---|---|
| `nr_throttled` 持续增长 | CPU 配额是瓶颈 | 去 CPU limit 或绑核 |
| `memory.stat` 里 `file` 占比高 | page cache 被回收 | 本地盘 / 提高 limit |
| `memory.events` 有 `oom_kill` | 触达内存上限 | 按工作集留余量 |
| `/dev/shm` 只有 64M | tmpfs 默认值 | emptyDir memory 覆盖 |
| `os.cpu_count()` ≫ 亲和核数 | 线程池会超配 | 显式设 OMP/MKL |

---

## 2. kubectl 基础

```bash
kubectl config get-contexts                 # 有哪些集群
kubectl config use-context <ctx>
kubectl cluster-info
kubectl api-resources | grep -i <关键字>     # 查 kind / 短名 / 是否命名空间级
kubectl api-versions
kubectl get ns
kubectl get all -n <ns>
kubectl get <kind> -A -o wide
kubectl get <kind> <name> -n <ns> -o yaml
kubectl get <kind> -n <ns> -o jsonpath='{.items[*].metadata.name}'
kubectl describe <kind> <name> -n <ns>       # 看 Events 与 Conditions
kubectl explain <kind>.spec --recursive      # 字段树，比查文档快
kubectl apply -f x.yaml
kubectl apply -f dir/ --dry-run=server -o yaml   # 只看服务端会生成什么
kubectl delete -f x.yaml --wait=false
kubectl diff -f x.yaml
kubectl get events -A --sort-by=.lastTimestamp | tail -30
```

格式化技巧：

```bash
# 自定义列
kubectl get pods -n <ns> -o custom-columns=NAME:.metadata.name,NODE:.spec.nodeName,IP:.status.podIP

# 按标签筛
kubectl get pods -n <ns> -l app=engine -o wide

# 看容器镜像
kubectl get pods -n <ns> -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[*].image}{"\n"}{end}'
```

---

## 3. 工作负载

```bash
# Deployment
kubectl create deploy web --image=nginx:1.27 --replicas=2
kubectl scale deploy/<dep> --replicas=4 -n <ns>
kubectl rollout status deploy/<dep> -n <ns>
kubectl rollout history deploy/<dep> -n <ns>
kubectl rollout undo deploy/<dep> --to-revision=2 -n <ns>
kubectl set image deploy/<dep> app=app:0.2 -n <ns>

# StatefulSet（身份 + 稳定域名）
kubectl get sts -n <ns> -o wide
kubectl rollout status sts/<name> -n <ns>

# Job / CronJob
kubectl create job --from=cronjob/<cj> manual-run -n <ns>
kubectl logs job/<job> -n <ns>
kubectl get cronjob -n <ns>
```

Deployment 与 ReplicaSet 的关系：改镜像 → 新 RS → 逐个新建/下线 Pod；`rollout undo` 就是切回旧 RS。

---

## 4. Service 与网络

```bash
kubectl get svc -n <ns> -o wide
kubectl get endpoints -n <ns>
kubectl get endpointslices -n <ns>
kubectl port-forward svc/<svc> 8080:80 -n <ns>     # 本机调试，绕过外部暴露
kubectl expose deploy/<dep> --port=8000 --target-port=8000 --type=NodePort -n <ns>
kubectl run tmp --rm -it --image=curlimages/curl -- sh   # 集群内探连通性
```

三种类型的排障差异：

| 类型 | 先查什么 |
|---|---|
| ClusterIP | Endpoints 是否为空（多为 readiness 不过） |
| NodePort | 端口是否与其它部署冲突（30000–32767） |
| Headless | DNS 是否能解析出 Pod 级地址（`pod-0.svc`） |

---

## 5. 配置：ConfigMap / Secret

```bash
kubectl create configmap app-conf --from-file=./user_config.json -n <ns>
kubectl get cm app-conf -n <ns> -o yaml
kubectl create secret generic regcred --from-file=.dockerconfigjson=$HOME/.docker/config.json --type=kubernetes.io/dockerconfigjson
```

注入方式与更新行为：

| 方式 | 改了之后 |
|---|---|
| 卷挂载（整目录） | kubelet 周期同步（分钟级）更新文件 |
| 环境变量 | 容器启动时固定，不会更新 |
| `subPath` 单文件 | 不会更新 |

因此「改了配置没生效」先确认是哪一种注入，再决定重启进程还是重建 Pod。

---

## 6. 存储

```bash
kubectl get pv
kubectl get pvc -n <ns>
kubectl get pvc -n <ns> -o wide
kubectl get sc                                   # StorageClass
kubectl describe pvc <name> -n <ns>              # 看绑定事件
kubectl get pv <name> -o yaml | grep -A3 claimRef
```

本地盘 PV 模板（`no-provisioner` 场景需手写）：

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: node4-data02-pv
spec:
  capacity: { storage: 100Gi }
  accessModes: [ReadWriteOnce]
  persistentVolumeReclaimPolicy: Retain
  storageClassName: local-storage
  local:
    path: /data02
  nodeAffinity:
    required:
      nodeSelectorTerms:
        - matchExpressions:
            - { key: kubernetes.io/hostname, operator: In, values: [worker-4] }
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: node4-data02-pvc
  namespace: lwh
spec:
  accessModes: [ReadWriteOnce]
  resources: { requests: { storage: 100Gi } }
  storageClassName: local-storage
```

绑定口诀：**类相同 + 模式匹配 + 申请 ≤ 提供**；本地盘还要节点亲和能命中。
`Pending` 排查顺序：`storageClassName` 拼写 → 容量是否超了 → `accessModes` 是否一致 → 节点亲和。

---

## 7. 探针与资源

```yaml
resources:
  requests: { cpu: "16", memory: "64Gi" }   # 调度依据
  limits:   { cpu: "16", memory: "64Gi" }   # 运行期 cgroup 上限
startupProbe:
  exec: { command: ["bash","-c","test -f /tmp/ready"] }
  periodSeconds: 10
  failureThreshold: 180          # 最长 30 分钟，覆盖大模型加载
readinessProbe:
  httpGet: { path: /health, port: 1025 }
  periodSeconds: 10
livenessProbe:
  httpGet: { path: /health, port: 1025 }
  periodSeconds: 20
  failureThreshold: 6
```

- `startupProbe` 通过前，`readiness` / `liveness` 不生效。
- 内存超 `limits` → `OOMKilled`，退出码 137。
- CPU 超 `limits` → 节流（`cpu.stat` 里的 `nr_throttled`），表现为延迟抖动而不是报错。

---

## 8. 调度

```bash
kubectl get nodes --show-labels
kubectl describe node <node> | sed -n '/Allocatable/,/Events/p'
kubectl get node <node> -o jsonpath='{.spec.taints}'
kubectl cordon <node> / kubectl drain <node> --ignore-daemonsets --delete-emptydir-data
kubectl uncordon <node>
kubectl get pods -n <ns> -o wide --field-selector spec.nodeName=<node>
```

| 约束 | 硬/软 | 常见错误 |
|---|---|---|
| `nodeSelector` | 硬 | 标签写错，静默 Pending |
| `affinity.required` | 硬 | 条件太窄，扩副本卡住 |
| `affinity.preferred` | 软 | 不生效但无报错 |
| `taints/tolerations` | 硬 | 没容忍，节点空闲也不用 |
| `topologySpreadConstraints` | 软/硬 | 不打散，单机故障全挂 |

---

## 9. CRD 与自定义资源

```bash
kubectl api-resources | grep -i <组名>
kubectl get crd | grep -i <关键字>
kubectl get crd <crd名> -o yaml              # schema、短名、打印列
kubectl explain <kind>.spec --recursive
kubectl get <kind>                            # 短名亦可，如 kubectl get ma
kubectl get <kind> <name> -o yaml             # spec 是声明，status 是进度
kubectl describe <kind> <name>                # 看 conditions 与事件
```

排障要点：

- 列表里的 `PHASE / READY / FAILED` 等列，来自 CRD 的 `additionalPrinterColumns`，数据源是 `status`。
- CR 建了不推进 → 先确认平台的 controller Pod 在跑，再看 `status.conditions`。
- 「部署文件」就是这份 CR 的 YAML；真正干活的是 controller 临时创建的 Job / Pod。

---

## 10. Helm 与 ArgoCD

```bash
# Helm
helm repo add <name> <url>
helm template <release> ./chart -f values.yaml -n <ns>     # 本地渲染，先看结果
helm install <release> ./chart -n <ns> --create-namespace
helm upgrade --install <release> ./chart -f values.yaml -n <ns>
helm get values <release> -n <ns>
helm get manifest <release> -n <ns>                        # 已部署的最终 YAML
helm history <release> -n <ns>
helm rollback <release> <rev> -n <ns>

# ArgoCD
argocd app list
argocd app get <app>
argocd app diff <app>
argocd app manifests <app>
argocd app sync <app>
kubectl -n argocd get application <app> -o yaml            # Application CR 本体
```

读 Application 的两段：`spec.source`（从哪拿模板、哪个版本）与 `spec.source.helm.valuesObject`（参数）。

---

## 11. 排障 playbook

```bash
# 1) 总览
kubectl get pods -n <ns> -o wide
kubectl get events -n <ns> --sort-by=.lastTimestamp | tail -40

# 2) 单个 Pod
kubectl describe pod <pod> -n <ns>
kubectl logs <pod> -n <ns> -c <container>
kubectl logs <pod> -n <ns> --previous
kubectl exec -it <pod> -n <ns> -- sh
kubectl get pod <pod> -n <ns> -o yaml > pod.yaml

# 3) 资源与配额
kubectl top pod -n <ns>          # 需要 metrics-server
kubectl describe node <node> | grep -A10 'Allocated resources'
kubectl get resourcequota,limitrange -n <ns>

# 4) 端口与连通
kubectl get endpointslices -n <ns>
kubectl port-forward pod/<pod> 8080:8000 -n <ns>
```

状态对照：

| 状态 | 含义 | 下一步 |
|---|---|---|
| `Pending` | 未调度 | `describe` 看 `FailedScheduling` 原因 |
| `ContainerCreating` | 挂卷 / 拉镜像中 | `describe` 看 Events |
| `ImagePullBackOff` | 镜像拿不到 | 镜像名、仓库连通、`imagePullSecrets` |
| `CrashLoopBackOff` | 进程反复退出 | `logs -p`、检查配置与权限 |
| `Terminating` 很久 | finalizer / 优雅退出 | `describe`、`--force --grace-period=0`（慎用） |
| `Evicted` | 节点压力 | 看节点 memory/disk pressure |

---

## 12. NPU（Ascend）专项

```bash
kubectl get nodes -o custom-columns=NAME:.metadata.name,NPU:.status.allocatable.huawei\.com/Ascend910
kubectl describe node <node> | grep -i ascend
kubectl get pods -n kube-system | grep -i -E 'device|npu|ascend'

# 容器内
npu-smi info
ls -l /dev/davinci* /dev/davinci_manager /dev/devmm_svm 2>/dev/null
echo $ASCEND_VISIBLE_DEVICES
```

- 资源名通常是 `huawei.com/Ascend910`，只在 `requests/limits` 里写，别用 CPU/内存模拟。
- 判断顺序固定：宿主 `npu-smi` → 节点 allocatable → Pod 的 `ASCEND_VISIBLE_DEVICES` → 容器内设备节点 → 框架初始化日志。
- 设备节点由 device plugin 与 Ascend Docker Runtime 注入；容器里看不到 `/dev/davinci*`，优先查插件与运行时。
- 多机大 EP 需要成组调度（Volcano），单看某个 Pod 的 `Pending` 会误判。

### 12.1 RDMA 与锁页（多机大 EP）

```bash
ulimit -l                          # 需 unlimited 或足够大，否则 ibv_reg_mr 失败
ls /dev/infiniband/uverbs* 2>/dev/null
ibv_devinfo 2>/dev/null            # 需要 rdma-core 工具
npu-smi info -t topo               # 卡与网卡的 PCIe / NUMA 相对位置
lspci -tv | grep -i -E 'mellanox|hinic'
cat /proc/meminfo | grep -i huge
```

| 现象 | 机制 | 处理 |
|---|---|---|
| `ibv_reg_mr failed` / HCCL 初始化失败 | memlock 不够，不是 cgroup | 放开 `ulimit -l` |
| 通信退化到 TCP、带宽只剩十分之一 | 有 hostNetwork 但没挂 `/dev/infiniband` | 挂设备或交给 RDMA device plugin |
| 带宽忽高忽低 | NPU 与网卡跨 NUMA | cpuset/内存策略与设备同域 |
| 多卡只看到一张 | 可见性由 `ASCEND_VISIBLE_DEVICES` 收敛 | 查环境变量与设备 cgroup |

---

## 13. 本地验证清单

按顺序跑一遍，每一步都在验证前面某一节的机制：

1. `kind` / `k3d` 起一个本地集群，`kubectl get nodes` 正常。
2. 跑一个 `nginx` Deployment，`port-forward` 打开页面。
3. 把副本数改成 3，再 `rollout undo` 回滚，观察 RS 变化。
4. 配 readiness 指向不存在的路径，看 Endpoints 里的 Pod 被摘除。
5. 手写 `local` PV + PVC，确认 `Bound`；把申请改成 2 倍，确认 `Pending`。
6. `helm template` 渲染一个最小 chart，对比 `kubectl get -o yaml` 的结果。
7. 找一个 CRD（`kubectl get crd | head`），`kubectl explain` 读它的 `spec`。
8. 把上面第 6 步排障 playbook 里的命令，在出问题的 Pod 上实际跑一遍。
