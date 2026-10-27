---
title: "CCSC 2026 研究札记 · 从输入变异到执行证据"
description: "从 RTL Fuzzing 到漏洞挖掘智能体：Reachability、Triggerability 与执行证据。"
locale: zh-CN
date: 2026-10-26
dateLabel: "2026/10/26 整理 · 草稿"
draft: true
tags: [CCSC2026, 软件安全, 智能体]
noteKind: reading
series:
  id: ccsc-2026
  title: CCSC 2026 研究札记
  order: 2
---

从硬件 RTL Fuzzing 到 Bulbasaur、TrigFuzz、PromeFuzz 和 DoGNAVY，几场报告处理的问题不在同一个层次。我想接着看的是，一次测试执行留下的信息，怎样帮助下一轮搜索。输入能否到达目标，是 **Reachability**；到达以后是否满足真正的触发条件，是 **Triggerability**；触发以后能否形成可观察、可利用的安全影响，是 **Exploitability**。

文中也会谈到 **State Construction / State-aware Analysis**。不过，只有局部分支、触发条件或 API 顺序还不足以解释目标状态时，才需要恢复更完整的状态构造过程。程序分析与 Specification 的前置讨论见 [Part 01：看懂代码，也要知道什么叫错](/writing/research-notes/ccsc-2026-part-01)；智能体安全、归因与治理的讨论在 [Part 03：当信息变成行动](/writing/research-notes/ccsc-2026-part-03) 继续。

## 从软件 Fuzzing 看硬件测试：大模型赋能的硬件安全测试



**清华大学 姜宇**


### 从软件 Fuzzing 看硬件测试


这场报告一开始讲的是硬件芯片测试。我对硬件没有太多基础，最开始看到 RTL、ISA、寄存器、仿真器这些词其实有点陌生，只有之前大二学计算机组成原理时的一点模糊印象了。但看到测试流程图以后，我的第一反应反而是：**这不就是 Fuzzing 吗？**


![硬件芯片测试关键流程](/images/ccsc-2026/image4.png)



只是被测对象从软件程序变成了硬件设计。


---

### 先补一点硬件基础：RTL 是什么


RTL 是 **Register-Transfer Level，寄存器传输级**。如果借用软件工程里的概念，可以粗略地把 RTL 理解成芯片设计阶段的"源代码"：设计者使用 Verilog、SystemVerilog 等硬件描述语言，描述寄存器保存什么状态、组合逻辑进行什么计算，以及数据如何随着时钟在寄存器之间传递。这里先记住三个东西就够了：


- **寄存器**：保存系统当前状态；
- **组合逻辑**：根据当前输入和状态进行计算；
- **时钟**：控制状态什么时候统一更新。


一个同步数字电路可以粗略写成：


$$
S_{t + 1} = F\left( S_{t},I_{t} \right)
$$



其中：


- $S_{t}$是第 $t$个时钟周期的寄存器状态；
- $I_{t}$是当前输入；
- $F$是由组合逻辑实现的状态转移函数；
- 下一个时钟沿到来时，$S_{t + 1}$ 被锁存进寄存器。



实际电路当然比这个抽象复杂得多，但从软件背景出发，先把 CPU 看成一个**由时钟驱动的巨大状态机**，已经足够理解后面的测试方法。同步电路中，组合逻辑必须在下一个采样时钟沿之前完成计算，这也是时钟周期、关键路径等问题的来源。于是再看报告里的芯片测试流程：


```text
初始种子 → 生成高质量测试用例 → RTL 仿真 / FPGA 加速 → Oracle 检查执行结果 → 异常检测 → 缺陷报告
```


换成软件中的模糊测试：


```text
初始种子 → 生成 / 变异输入 → 执行目标程序 → Crash / Sanitizer / Oracle → 异常检测
```


两者的基本骨架确实高度相似。区别主要在于"输入"和"状态"发生了变化。软件 Fuzzer 经常生成的是：


- 文件；
- 字符串；
- 网络报文；
- API 参数。


而处理器测试里的输入可能是：


- CPU 指令序列；
- 寄存器值；
- 中断；
- 外设事件；
- 不同的事件时序。


执行环境也从一个普通进程换成了 RTL 仿真器或者 FPGA。报告里的 **Oracle** 同样可以按照软件测试里的概念理解：它负责回答一个最基本的问题------**这次运行到底对不对？**



---

### 差分测试：两个完全不同的实现为什么可以互相检查


处理器验证里很常见的一种 Oracle 是**差分测试**。例如给：


- 被测 CPU 的 RTL；
- RISC-V 参考模型 Spike；


输入同一串指令。假设执行到某个位置以后：


```text
RTL CPU: x5 = 42
Spike: x5 = 43
```


这说明两者的行为发生了分歧。它们显然不是同一份代码：


```text
RTL CPU
├─ 流水线
├─ Cache
├─ 分支预测
├─ 中断
└─ 大量并行硬件状态

Spike
└─ 软件实现的 ISA 参考模型
```


双方能比较，是因为它们针对同一份外部规范——ISA 实现指令语义。Spike、QEMU 等软件参考实现可以作为测试中的对照基准，用来比较指令执行后的架构状态；这不意味着它们绝对正确，也不要求双方内部实现或时序相同。差分结果仍需要结合具体 ISA 规范、实现配置及未定义或实现定义行为判断。可以把它看成：


$$
Impl_{1}(x) = ?Impl_{2}(x),\,Impl_{1},Impl_{2} \vDash Spec
$$




代码结构可以完全不同，但只要规范规定某条指令执行完成后架构可见状态应该是什么，那么两个实现就应该在这些可观察状态上保持一致。软件世界里也有完全相同的例子：某个功能需要写一个排序算法，阿毛用 C++ 写了快速排序，小雯用 Rust 写了归并排序。代码语言不同、算法不同，但输入数组 [3, 1, 2]，两者的输出必须都是 [1, 2, 3]。如果阿毛输出了 [1, 3, 2]，那阿毛的代码必然有 Bug。


这里还要注意一个硬件中特别重要的问题：RTL 内部有流水线和推测执行，一条指令可能经过多个时钟周期才真正完成。所以实际比较通常要对齐到指令退休（retire / commit）等架构可见位置，而不能随便比较某个内部周期的瞬时状态。当然：


$$
S_{\text{RTL}} \neq S_{\text{ref}}
$$



并不能严格推出 RTL 一定有问题。因为参考模型也可能有实现错误，规范本身也可能包含未定义行为。因此更准确的说法是：**差异意味着出现了需要解释的不一致，通常再结合 ISA 规范判断哪一边违反了约束。**



---

### 协同演化搜索：只变异一串指令还不够


第一个让我觉得很有意思的点，是**指令与接口事件的协同测试**。最朴素的处理器 Fuzzing，可以不断生成指令序列：


```text
指令 A → 指令 B → 指令 C → ...
```


但复杂缺陷往往不是"执行某一条奇怪的指令"就会出现。它可能要求：


- CPU 正好处于某种执行上下文；
- 某个外部事件在这个时候发生；
- 内部共享状态已经满足某个条件；
- 事件还必须卡在特定的时序窗口。


![指令与接口交互异常的联合模型](/images/ccsc-2026/image5.png)



为了方便理解，可以把一次交互上下文抽象成：


$$
r = \left( c,e,s,w \right)
$$



其中：


- $c$：指令上下文（context）；
- $e$：接口事件（event）；
- $s$：共享状态（state）；
- $w$：时序窗口（window）。



这里的关键已经不是生成一个输入 $x$，而是协同生成两类输入：



$$
X = \left( P,\Gamma \right)
$$



其中：


- $P$：指令程序；
- $\Gamma$：接口事件序列。



测试引擎需要让 $P$和 $\Gamma$**一起变化**，并结合当前的 $c,e,s,w$判断这一轮执行是否进入了新的、有价值的交互状态。



换句话说，搜索空间从：


$$
\mathcal{X =}\left\{ P \right\}
$$



扩展成了：


$$
\mathcal{X =}\left\{ \left( P,\Gamma,c,e,s,w \right) \right\}
$$



这里真正困难的已经不是"找到一条特殊指令"，而是找到一组能够彼此咬合的执行条件。



这个思路放回软件测试里也很好理解。一个复杂漏洞可能并不是：


```text
恶意输入 → 某个函数 → 漏洞
```


而更像：


```text
初始化 → 改变内部状态 → 执行操作 A → 发生外部事件 → 执行操作 B → 触发异常行为
```


例如在 Web 系统中，可以粗略对应成：


- **上下文 / 初始化**：加载特定插件、配置或中间件；
- **共享状态**：前一个请求改变了 Session、缓存或全局对象；
- **事件 / 操作**：发起请求 A，再执行请求 B；
- **时序 / 顺序**：B 必须发生在 A 已经改变状态、但某个检查尚未完成的窗口中。


此时真正的测试输入已经不再是一个 Request Body。可以把一次候选测试抽象成：


$$
W = \left\langle C,\text{\:\,},S_{pre},\text{\:\,}I\text{\:\,}O \right\rangle
$$



其中：


- $C$：环境配置；
- $S_{pre}$：前置状态及其形成过程；
- $I$：真正的触发输入；
- $O$：调用顺序或时序。



这其实比"找一个 payload"更接近很多真实系统缺陷的触发条件。如果测试工具只会孤立地变异一次 API 请求的参数，就很难覆盖这种需要多个维度共同满足的执行轨迹。



#### 联合搜索，而不是逐维猜测


一种直观但容易出问题的方法是：


```text
先猜配置 C → 固定 C → 再猜前置状态 S → 固定 C、S → 再猜触发输入 I
```


问题在于这些维度并不是独立的。配置稍微变一点，后面的状态转移可能就完全不同；一个前置操作发生变化，触发输入所需要的形状也可能随之改变。因此更自然的方式是把：


$$
J = \left\langle C,S,I,O \right\rangle
$$



看成一个**联合搜索状态**。


每次迭代都可以对 $J$的不同维度进行变异，例如：



1.  修改 payload；


2.  插入或删除初始化步骤；


3.  改变前置状态构造过程；


4.  调整两个操作的先后顺序；


5.  改变事件发生的时机。


然后执行：


$$
J_{t}\overset{\text{mutate}}{\rightarrow}J_{t}'\overset{\text{execute}}{\rightarrow}R_{t}
$$



运行结果 $R_{t}$不只是一个：



success / failure 还可以包含多维反馈：


$$
R_{t} = \left\langle \text{Coverage},\text{StateChange},\text{Distance},\text{Oracle} \right\rangle
$$




例如：


- 有没有获得新的代码覆盖；
- 关键状态是否发生变化；
- 是否比上一轮更接近目标操作；
- 是否触发某种安全属性异常。


如果这一组输入让系统进入了更有价值的状态，就把整个 $J_{t}'$作为新的种子继续探索。



这里我更愿意把它理解成：<strong>测试用例本身不是一个值，而是一段执行历史。</strong>因此，复杂测试的目标也不只是寻找一个"神奇字符串"，而是在高维交互空间里搜索一条满足条件的执行轨迹。



---

### TrapFuzz：从"函数排列"转向"状态转移"


第二项工作是报告中标注为 **TrapFuzz (ASPLOS 2027, forthcoming.)** 的中断处理缺陷检测。

> **VERIFY_SOURCE**：这里沿用报告和原稿中的项目标注。截至 2026-10-26，仍未找到可独立核实的公开论文或 ASPLOS 2027 官方接收记录，下文的具体方法细节也未获公开原文支持；以下内容应理解为报告介绍与作者现场解释，而不是已确认发表版本的完整复述。


![TrapFuzz 中断处理错误检测](/images/ccsc-2026/image6.png)



CPU 处理中断时，本身就在做状态迁移。以 RISC-V 为例，可以简单把特权状态记成：


$$
S = \left\{ U,S,M \right\}
$$



分别对应用户态、监管态和机器态。中断或异常可能让 CPU 从一个状态跳到另一个状态，处理完成后再通过 mret、sret 等指令恢复。因此一个测试序列不只是： 

```text
interrupt A → interrupt B → interrupt C
```


而更像：


$$
s_{0}\overset{e_{1}}{\rightarrow}s_{1}\overset{e_{2}}{\rightarrow}s_{2}\overset{e_{3}}{\rightarrow}\cdots\overset{e_{n}}{\rightarrow}s_{n}
$$



其中：


- $s_{i}$是处理器关键状态；
- $e_{i}$是中断、异常、返回指令等事件。



报告中的思路是显式建立**多中断序列模型**，让测试生成器围绕状态转移生成序列，而不是随机排列中断事件。相关整理材料也把它概括成从"盲目试序"转向"显式状态模型驱动"。



这里的变化看起来只是从："下一步执行哪个动作？"变成："下一步应该把系统推进到哪个状态？"但两种搜索空间其实非常不同。


假设系统暴露 $n$个接口，测试长度为 $k$。



直接排列函数，最朴素的搜索空间接近：


$$
\mathcal{\mid A} \mid^{k} = n^{k}
$$



但大量 API 调用可能根本不会改变与目标相关的状态。如果把多个等价操作折叠为同一个状态转换：


$$
S_{i}\overset{a}{\rightarrow}S_{j}
$$



那么真正值得保留的不是动作 $a$本身，而是：



**它是否产生了一个新的、有价值的状态** $S_{j}$**。**



这使得问题开始接近图搜索：


$$
G = \left( V,E \right)
$$



其中：


- $V$：系统关键状态；
- $E$：能够改变状态的操作或事件。



测试问题变成：


$$
\text{find~path~}S_{0} \rightsquigarrow S_{target}
$$



而不是纯粹枚举：


$$
a_{1},a_{2},\ldots,a_{k}
$$



这个"搜索颗粒度从函数移动到状态"的变化，我觉得比单纯记住 TrapFuzz 的实现细节更值得带走。



#### Oracle 也不能只等 Crash


TrapFuzz 还有另一个比较重要的点：复杂硬件错误不一定会让 CPU 直接挂掉。例如某次中断返回以后：


- 特权级恢复错误；
- 某个 CSR 没有恢复；
- CPU 进入了活锁；
- 某些状态已经不符合规范；


处理器可能仍然在运行。所以可以把测试判定器抽象成一个向量：


$$
O = \left\langle O_{state},O_{behavior},O_{progress} \right\rangle
$$



分别关注：


- **状态一致性**；
- **行为异常**；
- **系统是否还能正常向前执行**。


这和软件测试里的情况也非常像。一个异常：


`TypeError: invalid input`


可能只是正常的输入校验。而一个真正的安全问题可能： `HTTP 200 OK` 整个过程中什么异常都没抛。所以更一般的测试 Oracle 应该回答的是：


$$
O(execution) = \left\{ \begin{matrix}
1, & \text{某个安全不变量被破坏} \\
0, & \text{否则}
\end{matrix} \right.\,
$$



而不只是：


$$
O(execution) = \text{crash?}
$$



也就是说：**安全测试关注的最终不是程序有没有"死"，而是某个不应该被破坏的语义约束有没有被破坏。**



---

### DRVFuzz：运行时反馈不只是裁判，也是导航


第三项工作是 **DRVFuzz**[\[1\]](#ref-1)。


![DRVFuzz 敏感数据模型与转移引导](/images/ccsc-2026/image7.png)



传统覆盖率引导的 Fuzzing 可以粗略写成：


$$
x_{t}\overset{\text{execute}}{\rightarrow}C_{t}
$$



然后判断：


$$
C_{t} \smallsetminus C_{seen} \neq \varnothing?
$$



如果产生了新的代码覆盖，就认为这个输入比较有价值，把它留到种子队列里。这种方法非常有效，但代码覆盖并不总能准确表达"测试是不是越来越接近关键行为"。例如：路径完全没变，并不代表内部状态完全没变 DRVFuzz 关注的就是这个差异。它首先利用：


$$
\text{ISA~Specification} + \text{CPU~配置}
$$



构建敏感数据模型，然后在执行过程中观察这些敏感对象的状态转移。可以把一次状态变化表示为：


$$
\tau_{t} = \left( s_{t},a_{t},s_{t + 1} \right)
$$



传统覆盖率反馈更关心：


$$
\Delta Coverage
$$



而这种状态导向的思路更关心：


$$
\Delta State
$$



或者：


$$
\tau_{t} \notin T_{seen}
$$



也就是：当前执行有没有产生此前没有见过、或者具有更高价值的状态转移？于是整个闭环变成：


```text
Model → 生成输入 → 执行 → 观测状态变化 → 选择高价值状态 → 生成下一输入 ↺
```

在会后整理时，我觉得这一点特别值得单独记下来：<strong>一次运行的结果不应该只用于回答"成功还是失败"，它还可以决定下一轮往哪里搜索。</strong>假设两个输入都没有触发最终异常：

```text
Input A → 系统状态没有变化
Input B → 敏感状态 S1 → S2
```


如果只看 Crash：


$$
A = B = \text{failure}
$$



但从状态探索角度：


$$
Value(B) > Value(A)
$$



因为 B 至少推进了系统状态空间。因此斗胆设想一下，后面测试可以定义某种基于状态转移的启发式优先级：


$$
Score(x) = \alpha \cdot Novelty(x) + \beta \cdot StateTransition(x) + \gamma \cdot GoalProximity(x)
$$



重点在于<strong>反馈开始携带方向信息。</strong>这和随机失败以后重新生成一个输入，是完全不同的测试范式，更有方向，也应该会更加高效。



---

### RISCSmith：找到错误还不够，还要找到"第一处错误"


第四项工作是 **RISCSmith** [\[2\]](#ref-2)。它的一部分工作是借助大语言模型分析 RISC-V UnifiedDB，完善指令语义模型。我不太了解这具体是什么意思，但对我来说，更有意思的是另一半：**低开销、细粒度的差分定位。**


![RISCSmith 指令构建与差分分析](/images/ccsc-2026/image8.png)



最简单的差分测试可能只比较程序最终状态：


$$
S_{RTL}^{final} = ?S_{ref}^{final}
$$



假如：


$$
S_{RTL}^{final} \neq S_{ref}^{final}
$$



我们知道存在异常，但不知道异常是什么时候开始的。假设测试程序包含：


$$
I_{1},I_{2},\ldots,I_{1000}
$$



最终状态不一致，并不意味着第 1000 条指令出错，也不代表满盘皆输，真正的根因可能在第 38 条： I1 ✓、I2 ✓、\...、I37 ✓、I38 × ← 首次异常/偏离点、I39 ×、\...、I1000 ×


因此更有价值的问题是寻找：


$$
k^{*} = \min\left\{ k \mid S_{k}^{RTL} \neq S_{k}^{ref} \right\}
$$



也就是**第一次出现状态分歧的位置。** RISCSmith 在 RTL 中加入轻量日志，结合被测处理器和参考模型的执行记录，对寄存器写回、内存写入、异常等信息进行更细粒度的比较，从而定位第一个差异，再进一步分析相关指令依赖和缩减测试用例。正所谓"一粒扣子扣错了，那后面的扣子都会扣错"，这解决了差分测试中一个非常现实的问题，如果只知道： 1000 条指令执行以后状态错了


人工还需要面对一整条长执行轨迹；如果知道：第 38 条指令以后第一次偏离找出第一粒扣错的扣子，那么搜索范围就被大幅压缩了。



这个思想放到软件调试里同样直观。假设执行轨迹是：


$$
E = \left\langle e_{1},e_{2},\ldots,e_{n} \right\rangle
$$



每一步都有一个期望状态：


$$
{\hat{S}}_{i}
$$



和实际状态：


$$
S_{i}
$$



那么真正有意义的是找到：


$$
i^{*} = \min\left\{ i \mid S_{i} \not\vDash {\hat{S}}_{i} \right\}
$$



也就是：<strong>第一次违反预期的位置。</strong>例如：

```text
步骤 1：初始化完成 ✓
步骤 2：输入解析成功 ✓
步骤 3：对象关键字段缺失 ×
步骤 4：后续操作失败
步骤 5：最终抛出异常
```


如果只看最后一步： `FAILED` 信息量很低。但如果能定位：


`First divergence = Step 3`


那么后面的分析范围就会迅速收敛。所以我觉得 RISCSmith 中最值得迁移的，不只是"大模型帮助理解指令规范"，而是：<strong>细粒度失败定位，把"最终结果不对"进一步推进到"从哪一步开始不对"。</strong>这实际上改变了运行反馈能够携带的信息量。



---

### 从这些工作里，我真正记住了什么


听这一段时，我一直有一种很明显的感觉：

**熟悉，但又不完全熟悉。**

陌生的是：

- RTL；

- RISC-V；

- 寄存器；

- 中断；

- 外设；

- 硬件时序。

但真正的问题又正好撞上了我熟悉的软件模糊测试和图论算法：

- 怎么避免在巨大输入空间里盲目搜索；

- 怎么表达复杂状态；

- 怎么处理多步骤执行序列；

- 什么样的运行时反馈真正有价值；

- Oracle 应该观察哪些语义；

- 失败以后怎么找到最早的异常点。


如果暂时把硬件细节拿掉，几项工作的共同演化大致可以写成：

```text
随机输入 → 执行 → Crash?
```

逐渐变成：

```text
语义 / 状态模型 → 约束驱动的输入生成 → 真实执行 → 细粒度状态观测 → 语义 Oracle → 反馈驱动的下一轮搜索
```

也可以更抽象地写成：


$$
M_{t}\overset{Generate}{\rightarrow}x_{t}\overset{Execute}{\rightarrow}E_{t}\overset{Observe}{\rightarrow}F_{t}\overset{Refine}{\rightarrow}M_{t + 1}
$$



其中：


- $M_{t}$：当前对目标系统的模型；
- $x_{t}$：生成的测试；
- $E_{t}$：真实执行；
- $F_{t}$：从执行中获得的反馈；
- $M_{t + 1}$：根据反馈更新后的搜索模型。



以前我理解 Fuzzing 时，注意力很容易集中在：<strong>怎么生成更多输入。</strong>但这几项工作让我觉得，面对复杂系统以后，问题其实已经逐渐变成：<strong>什么输入值得生成？运行以后值得观察什么？一次失败还能告诉我们什么？这些信息又怎样决定下一步往哪里搜索？</strong>从这个角度看，硬件模糊测试和软件测试当然不是同一个问题，但在约束驱动、状态空间探索、反馈引导和细粒度 Oracle这些更高层的抽象上，确实可以互相借鉴。

Input mutation 决定"试什么"，state analysis 决定"现在走到哪了、下一步该往哪走"。对于复杂、强状态依赖的系统，这两者其实都很重要。



## 智能模糊测试：从Reachability 到 Triggerability



**清华大学 张超**


第二天"后大模型时代"的软件与系统安全论坛里，清华大学张超老师介绍了两项大模型与模糊测试结合的工作：


- **Bulbasaur**：针对难分支在线生成专用变异器；
- **TrigFuzz**：利用漏洞触发条件引导定向模糊测试。


我第一次听报告时其实有点"似懂非懂"，很多单独的组件都很熟悉：


- 覆盖率引导；
- 分支约束；
- 输入变异；
- 动态反馈；
- 大模型生成；
- 定向模糊测试。


但两项工作放在一起以后，我后来才慢慢意识到，它们其实可以放进一条很连续的问题链里：


$$
\boxed{\text{Reachability} \rightarrow \text{Triggerability} \rightarrow \text{Exploitability}}
$$



这里三个概念可以粗略理解成：


### Reachability


$$
Reach(Target)
$$



程序执行能不能到达目标位置？


#### Triggerability


$$
Reach(Target) \land Satisfy(TriggerConditions)
$$



到了目标位置以后，真正触发漏洞所需要的条件能不能满足？


#### Exploitability


$$
Trigger(Vulnerability) \land ObservableSecurityEffect
$$



漏洞被触发以后，能不能进一步产生稳定、攻击者可利用的安全影响？这三件事其实不是一回事。传统 Fuzzing 很长时间主要解决的是第一层：<strong>怎样尽可能深入程序，覆盖更多代码。</strong>但真正做漏洞利用或者 PoC 时，很快会发现：


$$
Reachability \not\Rightarrow Triggerability
$$



同样：


$$
Triggerability \not\Rightarrow Exploitability
$$



Bulbasaur 和 TrigFuzz 恰好分别往前推进了其中不同的一段。




---

### Bulbasaur：不要让 LLM 直接猜输入，而是让它生成"怎么改输入"


Bulbasaur[\[3\]](#ref-3)的问题起点很经典：覆盖率引导的灰盒 Fuzzing 经常会卡在一些难以跨越的分支条件上，例如程序已经执行到了：


```text
if (magic == 0xdeadbeef) {
    target();
}
```


普通 bit flip、随机整数变异或者通用字典，很难碰巧得到正确值。传统 Fuzzer 使用的是：


$$
M_{generic}
$$



即一组对所有目标都一样的通用变异算子，而 Bulbasaur 做了一件很有意思的事：<strong>让 LLM 针对某一个具体的难分支，生成一个专门的变异器。</strong>于是：


$$
LLM \rightarrow M_{B}
$$



其中 $B$是当前目标分支，而：



$$
M_{B}:x \mapsto x'
$$



是专门为这个分支生成的变异函数，它并不是让 LLM 直接回答："下一个测试输入应该是什么？"而是让它回答：**"对于已经能走到这个分支的输入，应该怎么修改它？"**


这是我对 Bulbasaur 架构取舍的理解：逐次调用 LLM 生成输入，会给 Fuzzer 的高频执行循环增加延迟和 API 成本。论文采用异步生成变异器的方式，避免阻塞主循环（§4.1）。更值得复用的是：


$$
\boxed{LLM \rightarrow Mutation\text{~}Operator}
$$



而不是直接让 LLM 当微操大师，事无巨细的生成每一次详细的输入。生成出来的 mutator 还能被编译和重复使用，因此 LLM 实际上是在**在线生成领域专用搜索算子**。论文将其称为 branch-guided online mutator generation。


![Bulbasaur 分支变异器的生成与复用](/images/ccsc-2026/image32.png)





#### 为什么"局部改写"比重新生成整个输入更合理


这里有一个很重要的前提：当前 seed **已经能够走到目标 branch**。假设目标 branch 前已经存在一系列路径条件：


$$
PC_{1} \land PC_{2} \land \cdots \land PC_{n}
$$



当前输入 $x$已经满足：



$$
x \vDash PC_{1} \land PC_{2}\cdots \land PC_{n}
$$



只是当前 branch 条件：


$$
C_{B}(x) = false
$$



那么没有必要重新生成一个完整输入，再从头同时满足：


$$
PC_{1} \land PC_{2}\cdots \land PC_{n} \land C_{B}
$$



更合理的是尽可能保留当前 seed：


$$
x' = M_{B}(x)
$$



只修改与当前分支相关的部分，使：


$$
x' \vDash C_{B}
$$



同时不要破坏前面已经成立的：


$$
PC_{1},\ldots,PC_{n}
$$



也就是**保留已求解约束，然后局部求解新增约束**我觉得这个思想其实比"LLM 会解分支约束"本身更重要。它避免让大模型重复解决已经被 Fuzzer 解决过的问题。




---

### 静态语义 + 动态值：让 LLM 知道自己到底在改什么


要生成真正有效的 branch-specific mutator，光把：


```text
if (a == b)
```


丢给大模型显然不够。报告里首先强调了两类信息：


一类是**静态信息**：


- 项目文档；
- 输入格式；
- branch 附近源码；
- 常量；
- 解析逻辑；
- 调用关系。


另一类则是**动态信息**。例如 branch 实际执行时：


$$
op_{1} = 42,\,op_{2} = 43
$$



这意味着即使 LLM 不完全理解前面的所有计算过程，也可以知道当前真正的 mismatch 到底是什么。报告里用 CRC 一类条件举例时，这一点尤其明显，如果当前输入已经到达：


```text
if (computed_crc != stored_crc)
```


而运行时已经知道：


```text
computed_crc = 0x12345678
stored_crc   = 0x87654321
```


那么 mutator 未必需要重新理解整个 CRC 算法，它可能只需要学会怎样修改输入中负责保存 checksum 的字段。这实际上形成了**静态语义和运行时数值**共同为 LLM 提供 branch语义。




---

### 上下文不够怎么办：Code Query Agent


这里还有一个很容易把 Bulbasaur 理解错的地方。它并不是简单地截取目标分支附近十几行代码，然后完全依赖局部上下文。如果初始上下文不够，系统给 LLM 提供了一个 **Code Query Agent**，可以继续查询：


- 项目摘要；
- 目录结构；
- 文件；
- 关键词；
- caller / callee；
- 调用图。


![Code Query Agent 按需补充上下文](/images/ccsc-2026/image33.png)



所以更准确的说法不是 Bulbasaur 是 branch-local。而是：<strong>Bulbasaur 是 branch-centered，并允许按需扩展代码上下文。</strong>也就是：


```text
最小 branch context
        ↓
     不够？
        ↓
按需查询更多代码
        ↓
生成 mutator
```


报告自己也把"如何给 LLM 足够上下文、生成高质量变异器"列为一个主要挑战。这个设计我很认可：<strong>上下文相关性优先于上下文数量。</strong>不是一开始把整个项目塞进 context，而是围绕问题逐渐补充相关信息。




---

### 但 Branch 真的是足够好的分析颗粒度吗？


这也是我茶歇时问张超老师的问题，我的问题大意是： Bulbasaur 看起来比较适合输入与目标分支之间关系比较直接的约束。但如果一个 branch 依赖前面很长的状态构造过程，比如状态机或者多阶段解析，仅看 branch 周围的代码是不是就不够？这种情况更适合通过更强的静态程序分析补充数据流和调用链，还是利用 Fuzzing 运行时观察到的状态转移来引导？张老师首先认可：<strong>这类复杂情况确实是现有方法的局限。</strong>但他同时提到一个很现实的经验：**实际很多 branch，只利用分支附近的代码和现有上下文已经能够解决。**


后来重新看论文，我觉得这个回答其实非常符合 Bulbasaur 的设计哲学。Bulbasaur 选择了一个很在**上下文充分性和分析成本**之间的实际的权衡。对很多 branch：


$$
C_{B} = f\left( x,\text{local~context} \right)
$$



那么恢复完整程序状态显然没有必要。已有 seed 已经帮我们满足了大量前置路径条件，只需要局部解决最后一个 branch约束。这时候：


$$
C_{local} \ll C_{state - analysis}
$$



但效果已经足够好。所以没有必要为了少数复杂情况，对所有 branch 默认运行昂贵的：


- 精确跨过程切片；
- 全局数据流；
- 符号执行；
- 状态机恢复。




---

### 真正困难的是 Branch 只是一个高层状态的"投影"


但是确实存在另一类情况，例如：


```text
if (parser->state == READY) {
    vulnerable_operation();
}
```


branch 条件起来非常简单：


$$
state = READY
$$



问题在于 READY 并不是 input 中的一个直接字段，它可能是：


$$
S_{0}\overset{x_{1}}{\rightarrow}S_{1}\overset{x_{2}}{\rightarrow}S_{2}\cdots\overset{x_{n}}{\rightarrow}S_{READY}
$$



经过一整套：


- parser stage；
- 状态机；
- 对象初始化；
- 多轮输入；
- 跨函数状态修改；


才构造出来，而此时局部 branch 只能告诉我们：


$$
S_{n}.state = READY
$$



却不能告诉我们：


$$
S_{0} \rightsquigarrow S_{n}
$$



应该怎样实现。换句话说：<strong>branch 本身只是复杂 state construction process 最后的一个投影。</strong>论文自己也把 state-machine flags 和 multi-stage parsing 导致的 high-level semantic states 列为 limitation：如果缺少完整的 state construction 信息，LLM 可能无法生成有效 mutator。所以我当时真正想问的是：**Branch 作为分析颗粒度，什么时候会失去足够的语义？**




---

### State Construction 不是固定下一阶段，而是一层按需增强


下面是**容易误读的线性写法，本文不采用这一流程**：


$$
Branch\text{~}Reachability \rightarrow Triggering\text{~}Conditions \rightarrow State\text{~}Construction
$$



它会让人误以为所有漏洞都必须依次完成分支可达、触发条件和状态构造。更合理的组织方式是把状态分析作为按需增强层：


```text
             State Construction /
             State-aware Analysis
                ↙       ↘
               enrich   enrich
                 ↓       ↓
Reachability ───────→ Triggerability ─────→ Exploitability
```


也就是说：<strong>State 构建是基础流程之上的按需 refinement，而不是每个 case 都必须经历的固定阶段。</strong>对于普通情况：


$$
TC \approx f\left( x,\text{local~context} \right)
$$



branch 上下文、runtime 操作数和局部 mutator 已经够用了。只有少数特殊困难 case：


$$
TC = f\left( S_{n} \right)
$$



并且：


$$
S_{n} = T_{n}\left( \ldots T_{2}\left( T_{1},\left( S_{0},x_{1} \right)x_{2} \right)\ldots\text{ } \right)
$$



才需要进一步恢复：


$$
S_{0} \rightsquigarrow S_{n}
$$



也就是：<strong>这个状态究竟是怎么被构造出来的？</strong>这其实就是一个很典型的精度和成本的 trade-off。张老师说实际需要这种精准分析的情况并没有那么多，我觉得反而很好地解释了为什么 Bulbasaur 没有默认做完整状态分析。




---

### TrigFuzz：到了目标代码，不等于漏洞真的能触发


如果说 Bulbasaur 更多是在回答：<strong>怎样跨过阻碍执行继续深入的 hard branch？</strong>那么 TrigFuzz[\[4\]](#ref-4)接着问了另一个问题：<strong>就算已经到达漏洞附近，为什么 PoC 还是触发不了？</strong>这恰好对应：


$$
Reachability \not\Rightarrow Triggerability
$$



Directed Fuzzing 的传统目标主要是：


$$
distance\left( x,target \right) \rightarrow 0
$$



也就是让输入越来越靠近目标代码。但 TrigFuzz 的 motivating example 很直接：程序已经执行到 target code，但真正触发未初始化变量问题还需要满足：


$$
v < 2
$$



所以：


```text
Target Code Reached
        ≠
Vulnerability Triggered
```


报告直接把这部分拆成三个问题：


1.  怎么获得触发条件？


2.  怎么验证触发条件是正确的？


3.  怎么让 Fuzzer 真正利用这些条件？


我觉得这个问题定义非常重要，它把 Fuzzing 的目标从："让我走到这里。"进一步改成：**"让我到这里的时候，系统还必须处于真正能够触发漏洞的条件下。"**




---

### Triggering Condition：让"漏洞为什么会发生"成为新的反馈


TrigFuzz 首先让 LLM 根据：


- 源码；
- 漏洞报告；


提取漏洞触发条件。但它并没有停留在："LLM 说这个漏洞需要 x \< 2。"而是把 **Triggering Condition（触发条件）** 进一步结构化。报告中的一个 Triggering Condition Unit 可以表示为：


$$
TCU = \left\langle c,o,n,d,\text{~}loc\text{~}seq\text{~}conj\text{~}w \right\rangle
$$



其中：


- $cond$：具体条件；
- $loc$：条件所在位置；
- $seq$：多阶段条件之间的顺序；
- $conj$：多个条件之间的组合关系；
- $w$：权重。



![TrigFuzz 触发条件五元组](/images/ccsc-2026/image34.png)



这里的 seq 和 conj 我觉得尤其值得注意，最简单的 TC 可能只是：


$$
x < 2
$$



但真实漏洞可能需要：


$$
TC_{1} \land TC_{2}
$$



甚至：


$$
TC_{1} \rightarrow TC_{2} \rightarrow TC_{3}
$$



因此 TrigFuzz 已经开始表示：<strong>多条件、具有先后关系的漏洞触发语义。</strong>这已经比单纯的 branch condition 往 stateful reasoning 的方向迈了一步。不过需要注意的是当前这个并不是完整的状态机。它描述的是：<strong>触发条件之间的组合和阶段关系。</strong>还不是显式恢复：


$$
S_{0}\overset{a_{1}}{\rightarrow}S_{1}\overset{a_{2}}{\rightarrow}S_{2}
$$



这样的完整状态转移 model。所以它可以看作**已经开始碰到 state 层，但还没有真正把 State构建本身作为完整分析对象。**




---

### LLM 给出的触发条件不能直接相信


这一点和前面几场报告里反复出现的 pattern 非常一致。


$$
LLM\text{~}Generated\text{~}TC \neq True\text{~}Triggering\text{~}Condition
$$



LLM 完全可能：


- 理解错代码；
- 漏掉条件；
- 添加不存在的条件；
- 搞错顺序。


所以 TrigFuzz 后面专门做**候选触发条件验证**。而且不是再问另一个 LLM："你觉得刚才那个条件对不对？"而是重新回到 Fuzzing 和真实执行。


![TrigFuzz 三阶段触发条件验证](/images/ccsc-2026/image35.png)



可以粗略理解成：


```text
Candidate TC
     ↓
找到真正可达 TC 位置的输入
     ↓
主动注入满足 TC 的数据
     ↓
继续执行
     ↓
是否真的更接近/触发漏洞？
```


只有经过动态验证的 TC 才进入下一阶段。这又回到了这几场报告里反复出现的原则：


$$
\boxed{LLM\text{~}Hypothesis \rightarrow Execution \rightarrow Evidence}
$$



LLM 负责提出"我认为漏洞需要这些条件。"这样的假设，而执行负责回答：**"这些条件在真实程序里真的成立并有意义吗？"**




---

### 从 Triggering Condition 到 Triggering Distance


我觉得 TrigFuzz 最有意思的地方，是它没有让触发条件停留成一段漏洞解释。验证后的触发条件最终会被转化为**触发距离**，然后真正进入 Fuzzer 的反馈回路。


![触发距离引导的种子调度与字节变异](/images/ccsc-2026/image36.png)



它可以影响两个很熟悉的 Fuzzing 环节：


#### Seed Scheduling


优先选择：


$$
Distance\left( x,TC \right)
$$



更小的 seed，也就是：当前哪个执行状态离真正满足漏洞触发条件最近？


#### Byte-aware Mutation


优先修改那些真正影响上述**触发距离**的输入字节。于是触发条件不只是"漏洞知识"，而变成了一个**新的 Fuzzing 反馈信号**。它不是：


```text
LLM:
“你应该让 x < 2。”

Fuzzer:
“好的，谢谢建议。”
```


而是：


```text
LLM
 ↓
Trigger Condition
 ↓
Dynamic Validation
 ↓
Distance Function
 ↓
Seed Scheduling / Mutation
 ↓
Execution
 ↺
```


也就是说，大模型生成的语义知识最终被**编译进了 Fuzzing loop**。




---

### 两篇论文其实解决了连续的两个问题


后来把 Bulbasaur 和 TrigFuzz 放在一起看，我觉得它们其实非常连贯。


```text
Seed
  ↓
──────────────────────────
Barrier 1：难分支过不去
──────────────────────────
  ↓
Bulbasaur
Branch-Specific Mutator
  ↓
进入更深代码
  ↓
──────────────────────────
Barrier 2：到了目标但漏洞没触发
──────────────────────────
  ↓
TrigFuzz
Triggering Conditions
  ↓
漏洞被真正触发
```


所以可以理解成：


$$
\boxed{\text{Reachability} \rightarrow \text{Triggerability}}
$$



Bulbasaur 更多是在增强：


$$
Reach(B)
$$



TrigFuzz 则进一步考虑：


$$
Trigger(V) \mid Reach(Target)
$$



而两者都没有把整个 **Exploitability** 问题完全解决。因为：


$$
Trigger(V)
$$



以后还要继续问：是否产生了可观察的安全影响？攻击者是否真正可控？在真实环境中能否稳定利用？所以我更愿意把整个问题看成：


$$
\boxed{Reachability \rightarrow Triggerability \rightarrow Exploitability}
$$



这三个层次应该明确区分。




---

### Reachability、Triggerability 和 Exploitability


举一个极简例子，程序中有：


```text
if (authenticated) {
    if (length < 16) {
        memcpy(dst, input, attacker_len);
    }
}
```


#### Reachability


首先输入能不能走到：


```text
memcpy(...)
```


附近？可能要求：


$$
authenticated = true
$$



解决的是：


$$
Reach(memcpy)
$$





#### Triggerability


即使到了这里：


```text
memcpy(dst,input,attacker_len)
```


也不代表一定发生漏洞。可能还需要：


$$
attacker\text{\_}len > \mid dst \mid
$$



并且：


$$
length < 16
$$



同时成立。下面保留原稿的概念记号：`+` 表示这些条件需要联合满足，不是数值相加，也不是一条已经形式化证明的逻辑定理。


$$
Reach(Target) + TC_{1} + TC_{2} \rightarrow Trigger(V)
$$





#### Exploitability


但即使产生越界写：


$$
Trigger(BufferOverflow)
$$



也不代表一定可以利用。还需要继续回答：


- 覆盖了什么内存？
- 攻击者是否控制写入内容？
- 有无 ASLR / CFI / canary？
- 能否稳定产生安全后果？


于是：


$$
Triggerability \neq Exploitability
$$



这也是为什么我觉得：


$$
\boxed{Reachability \rightarrow Triggerability \rightarrow Exploitability}
$$



是一个非常值得保留的分析框架。它避免把："路径可达"直接等价成"漏洞存在"，也避免把："Bug 能触发"直接等价成"攻击者能利用"。




---

### 那 State Analysis 放在哪里？


结合之前硬件 Fuzzing 那一节，我后来越来越觉得：**Input Mutation 和 State Analysis 是两个互补维度。** Bulbasaur 已经把第一个做得相当漂亮。TrigFuzz 又开始通过：


$$
seq,\text{~}conj
$$



表达更复杂的触发条件。但对于少量特别复杂的：


- 状态机；
- 多阶段解析；
- 生命周期对象；
- 长状态构造链；


单纯围绕 branch 或 TC 可能还是不够。此时可以额外引入：


$$
StateConstruction
$$



或者更一般的：


$$
StateAwareAnalysis
$$



但它不是固定第三阶段，而应该是一层**按需增强**：


```text
                 State-aware Analysis
                ↙                  ↘
          enrich                    enrich
             ↓                        ↓
Reachability ─────→ Triggerability ─────→ Exploitability
```


对普通 case：


$$
TC \approx f\left( x,\text{~}local\text{~}context \right)
$$



直接做局部 mutation 最划算。对少数困难 case：


$$
TC = f\left( S_{n} \right)
$$



才进一步恢复：


$$
S_{0} \rightsquigarrow S_{1} \rightsquigarrow \cdots \rightsquigarrow S_{n}
$$



也就是：<strong>究竟通过什么状态构造过程，系统才能进入满足 TC 的状态？</strong>这不是简单追求"分析越精确越好"。而仍然是精度和成本之间的权衡。张老师茶歇时提到实际很多 branch 仅利用局部信息已经能够处理，我觉得这正好提醒了一个很容易犯的错误：<strong>不要因为完整状态分析理论上更强，就默认所有问题都值得支付这个成本。</strong>更合理的策略可能始终是优先使用便宜快速的局部推理，有必要时再选用更重的精确分析。




---

### 我最后真正记住的几点


这两项工作以后我还会单独仔细读论文，但从报告和目前的初步阅读来看，我最想留下的是下面四点。


#### 1. LLM 不一定负责直接生成答案，也可以负责生成新的搜索算子


Bulbasaur：


$$
LLM \rightarrow Mutator
$$



这比：


$$
LLM \rightarrow Input
$$



更有复用性，也更自然地融入传统 Fuzzing。




#### 2. Reachability 和 Triggerability 是两个独立问题


$$
Reach(Target) \not\Rightarrow Trigger(V)
$$



Bulbasaur 更靠近前者；TrigFuzz 明确把后者单独提出来解决。这一点我认为非常重要。




#### 3. LLM 产生的漏洞语义最终必须进入真实反馈闭环


TrigFuzz 没有停留在"LLM 给出 Triggering Condition"，而是：


$$
TC \rightarrow Dynamic\text{~}Validation \rightarrow Triggering\text{~}Distance \rightarrow Fuzzing\text{~}Feedback
$$



让语义知识真正变成搜索信号。




#### 4. State Analysis 是按需提高分析颗粒度的一种方式


对大量 branch：


$$
local\text{~}context + runtime\text{~}operands
$$



已经够用。但遇到：


$$
BranchCondition = f(HighLevelState)
$$



时，问题就可能从"怎样修改输入？"升级成：<strong>"怎样构造产生这个条件所需要的状态？"</strong>这和前面硬件 Fuzzing 里得到的结论正好呼应：<strong>Input mutation 决定"试什么"，state analysis 决定"现在走到哪了，以及下一步怎样才能继续推进"。</strong>两者没有谁天然应该统治整个系统，而应该根据问题复杂度选择合适的分析颗粒度。



## 可信漏洞挖掘智能体：模型之外，系统才是产品



**中国科学院软件研究所 贾相堃**


这一场没有像前面的 Bulbasaur 或 FM-Agent 那样围绕一个非常集中的算法问题展开，更像是在回答一个系统工程问题：<strong>如果真的想把大模型做成能够长期执行复杂漏洞挖掘任务的智能体，除了模型本身，还缺什么？</strong>报告从一些现实案例切入，最后给出的判断其实很明确。


第一，漏洞挖掘任务通常拥有巨大的代码和工具上下文，**上下文质量会直接影响模型输出是否有效**；第二，仅靠简单对话无法处理长任务链和多轮反馈，需要专门设计 Harness 来组织智能体的执行过程；第三，真正面向产品级漏洞挖掘时，大模型只是系统中的一个组成部分，完整系统还需要程序分析、专业工具、任务编排和验证能力。 面向漏洞挖掘场景的可信智能体构造思考与实践


![复杂漏洞任务中的 Harness](/images/ccsc-2026/image42.png)



我后来觉得，这几页真正值得记下来的其实是一句话：


$$
{Model}_{Capability} \neq {System}_{Capability}
$$



或者写完整一点：


$$
\text{System~Capability} = \text{Model} + \text{Context} + \text{Harness} + \text{Tools} + \text{Feedback} + \text{Verification}
$$



这和我之前对所谓 "AI-native" 系统的理解也比较接近。AI-native 并不是把原来的所有传统模块都删掉，只留下一个更强的大模型；相反，一个真正围绕模型重新设计的系统，往往更需要认真处理：


- 模型到底应该看到什么；
- 它能调用什么能力；
- 不确定推理如何被外部事实约束；
- 一次失败怎样变成下一轮输入；
- 最终结论如何被独立验证。


模型只是整个闭环中的一个组件。




---

### Context 和 Harness：真正的问题不是"塞更多代码"


漏洞挖掘对上下文的需求很特殊，目标代码可能依赖：


- 跨文件调用链；
- 数据流；
- 配置；
- 第三方库；
- 构建环境；
- 文档；
- 历史分析结果；
- 动态执行信息。


最直接的办法当然是给 LLM 喂更多的 Context。但很显然，上下文窗口变长以后，并不自然意味着分析能力线性提升。报告里提到的一个问题就是：漏洞挖掘包含大量与当前任务无关的信息，如果没有结构化组织，模型很容易受到"距离衰减"、中间信息丢失等问题影响。 面向漏洞挖掘场景的可信智能体构造思考与实践。所以更准确的目标应该是：


$$
\boxed{Relevant\,Structured\,Context > Raw\,Large\,Context}
$$



而 Harness 的作用，也不只是"写几个 Agent Prompt"，它更像整个漏洞分析系统的执行骨架：


```text
任务
 ↓
拆分子问题
 ↓
选择工具
 ↓
获得分析结果
 ↓
更新上下文
 ↓
生成下一步动作
 ↓
验证 / 失败反馈
 ↓
继续分析
```


换句话说：<strong>Context 决定模型知道什么，Harness 决定模型怎样使用这些知识。</strong>这两件事加起来，往往比单纯的"力大砖飞"更换一个参数量更大的模型重要。




---

### PromeFuzz：Harness 质量取决于模型拿到了什么知识


报告最后提到的 PromeFuzz[\[5\]](#ref-5)，我觉得正好可以作为这个观点的一个具体例子，PromeFuzz 要解决的是：<strong>怎样自动为 C/C++ 库生成有效的 Fuzzing Harness。</strong>最简单的想法当然是：


```text
Library Source Code
        ↓
       LLM
        ↓
Fuzz Harness
```


但这很容易生成"能编译但不会真正深入库逻辑"的 Harness，原因在于一个库的正确使用往往本身就有大量隐式知识。例如一个 API 可能不是：


```text
parse(data);
```


直接调用就够了，而是可能会有完整的状态调用序列：


```text
create()
   ↓
configure()
   ↓
set_option()
   ↓
load(data)
   ↓
process()
   ↓
destroy()
```


如果缺少前置初始化：


```text
process()
```


即使代码能够正常编译，但可能永远只会得到 not initialized 的状态，这时候无论怎样变异 data 都没有意义，所以真正需要生成的 Harness 可以抽象成：


$$
H = \left\langle APISequence,Arguments,ObjectState,Dependencies \right\rangle
$$



![PromeFuzz 知识驱动的 Harness 生成](/images/ccsc-2026/image43.png)



PromeFuzz 并不是要求模型自己每次从整个源码里重新发现这些关系，而是先从多个来源提取结构化知识，包括：


$$
K = K_{code} \cup K_{doc} \cup K_{usage}
$$

其中可以包括：


- API 元数据和类型；
- 调用关系；
- API 调用顺序；
- 文档中的使用约束；
- 真实 consumer code 中的 API usage pattern。


然后：


$$
K \rightarrow LLM \rightarrow Harness
$$



我觉得这里真正值得借鉴的不是"LLM 可以写 Harness"，而是：<strong>先把与任务真正相关的结构显式提取出来，再让模型在这些结构之上推理。</strong>这和前面很多报告其实是一脉相承的，AgentFlow 先把 Agent-specific semantics 降成可分析的依赖图；多语言漏洞分析先把源码降低到统一 IR；FM-Agent 先显式生成 Specification；PromeFuzz 则先显式组织 API 应该怎样被使用。它们共同在做一件事：


$$
\boxed{Raw\,Information \rightarrow Structured\,Intermediate\,Artifact \rightarrow LLM\,Reasoning}
$$

而不是每次都让 LLM 从原始数据重新发现全部结构。




#### Harness 本身也是 State Construction


我觉得 PromeFuzz 和前面硬件 Fuzzing、Bulbasaur / TrigFuzz 那几节还有一个很自然的联系。如果 API 必须按照：


$$
f_{1} \rightarrow f_{2} \rightarrow f_{3}
$$



调用，原因往往不是单纯"文档这么写"，而是：


$$
S_{0}\overset{f_{1}}{\rightarrow}S_{1}\overset{f_{2}}{\rightarrow}S_{2}\overset{f_{3}}{\rightarrow}S_{3}
$$



这些 API 在不断构造被测对象的内部状态。于是 Harness Generation 实际上包含 Input 构造和 State 构造两个问题。如果只生成 payload，却没有把系统推进到真正有意义的状态，那么 Fuzzer 很可能一直停留在浅层错误处理代码。所以 PromeFuzz 对 API usage pattern、调用顺序和依赖关系的利用，本质上也是在回答：<strong>怎样先把系统放到值得 Fuzz 的状态？</strong>这又回到了前面那句已经反复出现的判断：**Input mutation 和 state analysis 同样重要。**




#### 生成 Harness 也不应该是一次性的


PromeFuzz 还有一个我比较喜欢的地方：生成过程不是完全静态的，它会利用实际 Fuzzing 过程中的运行反馈继续调整生成结果。所以更合理的流程是：


$$
Knowledge \rightarrow Harness \rightarrow Compile/Execute \rightarrow Feedback \rightarrow Refinement
$$



而不是：


$$
Source \rightarrow LLM \rightarrow Harness \rightarrow Done
$$



这又是整篇会议笔记里反复出现的一条主线：


$$
Reasoning \rightarrow Execution \rightarrow Feedback \rightarrow Refinement\,
$$



模型负责提出方案，真实系统负责告诉它这个方案到底行不行。




---

### "可信"可以拆成两件事：过程可信和结果可信


报告里另一个我觉得很值得留下来的框架，是把"可信"拆成了**过程可信和结果可信**两部分。报告的系统总图也明确把右侧目标分成"过程可信"和"结果可信"。 面向漏洞挖掘场景的可信智能体构造思考与实践


![漏洞挖掘中的过程可信与结果可信](/images/ccsc-2026/image44.png)





#### 过程可信：为什么 Agent 会得出这个结论？


对于一个复杂漏洞挖掘智能体，最后得到"这里存在漏洞"的结论，其实远远不够，还应该知道：


```text
任务是怎么拆的？
↓
查询了哪些代码？
↓
调用过哪些分析工具？
↓
得到了什么中间结果？
↓
哪些假设被推翻？
↓
哪些证据被保留？
↓
最后为什么形成这个结论？
```


因此：


$$
ProcessTrust \approx Traceability + Provenance + Auditability
$$



报告后面提出了**全过程审计**：记录任务分解、路径选择、样本数据、中间结果和错误信息，并进一步从这些过程信息中提取领域知识。 面向漏洞挖掘场景的可信智能体构造思考与实践


![过程审计、知识抽取与系统演进](/images/ccsc-2026/image45.png)



这里 Audit 就不只是出了问题以后"翻日志看看 Agent 当时干了什么"，它还可以进一步成为系统学习的原材料。




---

### Audit → Knowledge → Next Analysis


如果智能体每次完成漏洞分析以后，都能沉淀：


- API 语义；
- 数据结构；
- 敏感函数；
- 常见失败模式；
- 有效 Harness；
- 漏洞规则；
- 已验证 PoC；


那么就可以形成：


$$
Experience_{t} \rightarrow Knowledge_{t + 1} \rightarrow Analysis_{t + 1}
$$



于是系统不需要每次从零开始，这个方向我比较认可。但这里也有一个很容易踩的坑，如果所谓 Knowledge 本身只是："上一次 LLM 是这么说的。"那么：


$$
WrongReasoning \rightarrow Memory \rightarrow FutureReasoning
$$



反而可能把一次幻觉变成长期错误知识，所以我觉得真正可靠的知识沉淀应该至少绑定：Knowledge + Provenance + Evidence + ValidationStatus。例如：


```text
Fact:
source → sink path

来源:
static analysis tool

状态:
verified
```


和：


```text
Hypothesis:
某函数可能缺少权限检查

来源:
LLM reasoning

状态:
unverified
```


不能被当成同一种知识。再例如：


```text
PoC Observation:
攻击输入导致目标文件被覆盖

来源:
sandbox execution

状态:
runtime-confirmed
```


证据等级应该不同。我觉得这和报告强调的"全过程审计"其实天然应该绑在一起：**没有 provenance 的 memory，很难真正成为可信知识。**




---

### 结果可信：Reasoning 只是 Hypothesis，Execution 才能提高证据等级


结果可信这一块，报告给出的思路其实和前面几场已经非常熟悉了：


$$
\text{LLM~Hypothesis} \rightarrow \text{Independent~Validation}
$$



例如：


- 程序分析；
- 环境构建；
- PoC；
- 动态执行；
- 多种验证机制。


所以这里不需要再展开一次完整方法，可以直接总结为：**Reasoning generates hypotheses; execution provides evidence.**


"模型觉得这里有漏洞"不等于"静态路径存在"，不等于"PoC 看起来合理"，更不等于"在足够真实的环境中观察到了安全属性被破坏"。它们应该属于不同证据等级。




---

### FirmHound、OSmart 和 AirTaint：几种不同的底层能力


报告还提到了几项过去和后续工作，这里我觉得不需要分别展开，只需要把它们理解成：**可信漏洞挖掘 Agent 底下可以接入哪些真正有用的专业能力。**


#### FirmHound：发现以后，还要验证


FirmHound[\[6\]](#ref-6) 的题目是：


Discovering and Validating Firmware Vulnerabilities through Agentic Binary Reasoning

> **VERIFY_SOURCE**：本节只按大会报告和作者页自述介绍 FirmHound。原稿与 Wei Zhou 的作者出版页标注为 **S&P 2027**；截至 2026-10-26，尚未找到可独立确认的官方接收条目、正式 proceedings 或 DOI，因此不把它写成已发表论文；当前公开信息也不足以支持对其完整方法作更强断言。


目前公开信息还不足以完整还原方法，所以这里不展开，但仅从工作定位看，它延续的仍然是：


$$
\text{Vulnerability~Reasoning} \rightarrow \text{PoC~/~Dynamic~Validation}
$$



也就是从假设到执行验证这条线。等完整论文公开以后，我觉得它会比当前报告里的简略介绍更值得仔细看。




#### OSmart：Configuration 也是测试输入


OSmart[\[7\]](#ref-7) 做的是程序配置选项 Fuzzing。对于：


```text
--mode=a
--feature=x
--cache=true
--parser=b
```


最直接的方法是枚举所有配置组合。如果有 n 个布尔选项，搜索空间就是 2 的 n 次方。但很多组合实际上：


- 不可达；
- 无意义；
- 互相依赖；
- 只有在特定控制流下才生效。


OSmart 利用控制依赖和数据依赖恢复真正有意义的 option 组合。这提醒了一个很容易被忽略的问题：<strong>测试输入不一定只是 payload，configuration 本身也是输入空间的一部分。</strong>如果统一写成：


$$
W = \left\langle Config,State,Input,Sequence \right\rangle
$$



那么 OSmart 主要是在认真解决 Config 这个维度，这和前面多维测试状态的讨论可以很好地接起来。




#### AirTaint：运行时证据不是免费的


AirTaint[\[8\]](#ref-8) 关注的是动态污点分析的运行时开销。如果希望一个 Agent 获得更多 runtime evidence：


```text
真实数据流
对象状态
参数传播
敏感值
```


最直接的办法当然是插桩。但获取更多的证据往往意味着更多的开销。动态污点追踪尤其容易变得非常昂贵。AirTaint 的思路是把污点规则提升到更粗的基本块级别，并使用更轻量的插桩方式降低动态分析开销。这篇目前不用深究，但它提醒了一个以后任何 execution-grounded 系统都会遇到的证据质量和观测开销的 trade-off，我们当然希望把所有运行时状态都给 Agent，但真实系统最终一定会问："代价是多少？"




---

### 这里又出现了一个熟悉的问题：Specification bottleneck


把"过程可信"和"结果可信"做得再完整，最后还是会遇到一个非常基础的问题：<strong>到底什么行为算错？</strong>假设动态验证得到：PoC successfully executed，但是这并不能自动推出存在安全违规行为，还需要某个：Specification 告诉系统，这种执行结果是否违反了原本应该满足的安全属性。也就是：


$$
ObservedBehavior \nvDash SecuritySpecification
$$



才真正形成安全结论。这又回到了前面 FM-Agent 中那个熟悉的：Specification Bottleneck 问题，FM-Agent 问的是：一个函数本来应该做什么？这里换成漏洞分析以后，问题变成：一个系统在这个身份、状态和输入条件下，本来应该允许什么？


工具可以让： ProgramFacts 更准确；Execution 可以让：Evidence 更强；Audit 可以让：Process 更透明，但最终系统仍然需要知道：<strong>究竟什么样的行为才算违规？</strong>这一点我觉得和前面几场报告形成了非常漂亮的呼应。




---

### 再和 AgentFlow 放在一起看


前面王浩宇老师的 AgentFlow 解决的是：


$$
\text{Agent~System} \rightarrow \text{Analyzable~Representation}
$$



也就是系统里有哪些 Agent、Prompt、Tool、Memory、Policy，它们之间是什么依赖关系？这提供的是 ProgramFacts；FM-Agent 则提醒我们：有事实还不够，还需要知道"正确行为是什么"。也就是Specification。而这一场又继续往后走：有了系统事实和行为规则以后，怎样通过程序分析、Fuzzing、执行验证和全过程审计得到可信结论？于是几场报告其实可以重新组织成一条线：


$$
Representation \rightarrow Specification \rightarrow Analysis \rightarrow Execution \rightarrow Evidence \rightarrow Audit
$$



我觉得这比单独记每篇论文用了多少 Agent、调用了几个工具有意思得多。

## DoGNAVY：另一条很有意思的“AI-native 漏洞分析”路线


**摘自：上海人工智能实验室 刘东瑞的报告**


前一节讨论了怎样通过程序分析、执行验证和全过程审计，让漏洞挖掘智能体给出更可信的结论。DoGNAVY[\[9\]](#ref-9) 提供了一个具体的对照，可以接着看这些环节在实际工作流里是怎样组织的。刘东瑞老师在报告中展示了它的成果页，对应三个不同任务：


```text
CyberGym-漏洞复现
ExploitGym-漏洞利用
PatchEval-漏洞修复
```


这几个任务可以很好地放进前面一直使用的框架：


$$
\boxed{Reachability \rightarrow Triggerability \rightarrow Exploitability \rightarrow Repair}
$$



---

### CyberGym：先证明漏洞能被真实触发


CyberGym[\[10\]](#ref-10) 给 Agent：


- 漏洞描述；
- 未修复的真实代码库；


让它自己生成 PoC，任务不是回答"第几行有漏洞？"，而是找到：


$$
Entry \rightsquigarrow Bug
$$



所需要的：


- 输入；
- 状态；
- 路径条件；


最终生成能够真正触发漏洞的输入。CyberGym 共有 1,507 个真实历史漏洞、覆盖 188 个开源项目；评测要求 PoC 在漏洞版本上触发，而在修复版本上不再触发。因此 Static suspicion 并不够，需要 Executable Witness。


---

#### ExploitGym：触发 Bug 以后，还能不能推进到安全影响？


ExploitGym[\[11\]](#ref-11) 则更进一步，它直接给一个已经能触发漏洞的输入，然后问 Agent：**能不能把这个 primitive 推进成 benchmark 指定的真实安全目标？**


官方对任务的描述就是：输入已经能够触发 vulnerability，Agent 需要构造完整 exploit，达到未授权代码执行等目标。所以能够触发 Bug 只是起点，真正的问题是：


$$
Bug \rightarrow Primitive \rightarrow SecurityObjective
$$



这恰好对应：


$$
\boxed{Triggerability \rightarrow Exploitability}
$$



而且 benchmark 还专门用外部 judge 判断最终成功是不是通过**目标漏洞**实现，因为：


$$
FlagCaptured \nRightarrow TargetVulnerabilityExploited
$$



这又是一种很严格的证据规约。


---

#### PatchEval：最后还要证明补丁既安全，又没有破坏原功能


修复阶段则要求同时满足：


$$
SecurityTest\left( P_{patched} \right) = Pass
$$



以及：


$$
FunctionalityTest\left( P_{patched} \right) = Pass
$$



PatchEval[\[12\]](#ref-12) 的 runtime 沙箱子集就是同时执行安全测试和功能测试，而不是一刀切的"PoC 不再被触发就算修好了"。因此整个过程可以写成：


$$
\boxed{Reproduce \rightarrow Exploit \rightarrow Repair \rightarrow Validate}
$$



这让我觉得 DoGNAVY 很像在尝试把漏洞生命周期做成真正的 agentic workflow，而不只是："LLM 帮忙看代码。"


---

### DoGNAVY 最吸引我的地方：分析策略由真实 Evidence 不断重构


DoGNAVY 在 CyberGym 上采用的工作流不是：


```text
Static Analysis → Generate PoC → Done
```


而更像：


$$
Hypothesis_{t} \rightarrow Execution_{t} \rightarrow Evidence_{t} \rightarrow Hypothesis_{t + 1}
$$



它会把：


- 静态路径；
- PoC construction；
- runtime feedback；
- independent review；


放在一个多智能体循环里，并允许随着新 evidence 出现重新调整分析方向，所以这条路线更接近：


$$
\boxed{Analyze \rightarrow Execute \rightarrow Observe \rightarrow Refine}
$$



也正是前面一直讨论的那种 **runtime-guided progressive refinement。**


---

### 但自由度是有代价的


这里恰好可以回扣第一天张源老师讲的多语言漏洞分析框架，那套方法更接近：


```text
Static Analysis First
       ↓
判断当前任务复杂度
       ↓
简单任务：静态工具完成
       ↓
复杂任务：增加 Context / 调用 LLM
```


它强调：


$$
\text{Determinism} + \text{Efficiency} + \text{Selective~Escalation}
$$



而 DoGNAVY 更像：


```text
提出 Hypothesis
   ↓
真实执行
   ↓
拿到 Evidence
   ↓
重新分析
   ↓
再次执行
   ↺
```


它强调：


$$
\text{Adaptability} + \text{Runtime~Feedback} + \text{Flexible~Exploration}
$$



DARKNAVY 的技术报告给出了这条路线的成本：在其使用 GLM-5.2 的 CyberGym 完整评测中，平均每任务消耗约 26.06M tokens、347.74 次 LLM 请求，轨迹持续 87.43 分钟，估算模型成本为 15.03 美元；最昂贵任务为 111.86 美元。这里的轨迹时间不含环境构建、设置与清理，成本也取决于报告采用的模型和计价配置。这组数据是该评测的均值，不能直接当作不同范式在相同任务上的成本对照。[\[9\]](#ref-9)这就是高度自主、不断试探和回溯的 Agent Loop 的另一面。



## 结语：不同任务需要不同的分析策略


### 两种范式，我觉得很难简单说谁"更先进"


把两场报告放在一起看，我反而越来越不想用“新的 Agent 闭环一定淘汰传统静态分析流水线”这类非黑即白的说法来概括。它们更像是两个不同的优化点，很难简单说谁更先进。


#### 静态分析主导、按复杂度升级


这种方式成本低，确定性更强，结果容易复现，也能高效处理大量简单 cases。但初始分析和路由 policy 得足够可靠。如果一开始的路由就判断错误：


$$
Candidate \notin C_{0}
$$



或者：


$$
D(x) = High,\quad\hat{D}(x) = Low
$$



后续又没有纠偏机制，就会越走越偏，真正困难的问题可能提前被错过。


#### 运行时指导的 Agent Loop


面对未知 case，Agent Loop 则更加灵活，可以根据 Runtime Evidence 动态调整：


- 分析范围；
- PoC；
- 工具选择；
- 假设。


它不要求一开始就知道应该走哪条分析路线，但代价是：


$$
\text{Token~Cost} + \text{Execution~Cost} + \text{Latency} + \text{System~Complexity}
$$



这些成本都会明显提高。所以我觉得，两者还是要作为多目标优化问题，放在具体任务里比较。现有证据还不足以说明哪一方在所有任务上都占优；不同 benchmark 的结果，也不足以说明两者处在同一条 Pareto Frontier 上。要讨论更强的支配关系，需要相同的任务分布、统一的成本口径和多目标实验。就现有材料看，两种范式可能在不同任务分布下各有成本—能力优势：一边偏向 **cheap, deterministic, analysis-first**，另一边偏向 **adaptive, execution-grounded, exploration-heavy**。最合适的策略，很可能还是取决于具体场景里的任务分布。


大量简单 case 没必要启动数百轮 Agent Loop；极少数复杂、未知、状态依赖严重的 case，又未必应该被固定流水线过早放弃。我觉得这是这次大会几场报告连起来以后，一个比"哪个系统 benchmark 更高"更值得留下来的认识。


## 参考资料

<a id="ref-1"></a>

[1] Yu Zehong, Chen Yuanliang, Yan Zhen, et al. DRVFuzz: Data-Sensitive RISC-V CPU Fuzzing[C/OL]//35th USENIX Security Symposium (USENIX Security 26). USENIX Association, 2026: 2505-2521. [https://www.usenix.org/conference/usenixsecurity26/presentation/yu-zehong](https://www.usenix.org/conference/usenixsecurity26/presentation/yu-zehong).

<a id="ref-2"></a>

[2] Zhang Xudong, Chen Yuanliang, Yu Zehong, et al. RISCSmith: Finding RISC-V CPU Bugs via Rich Instruction Construction and On-the-Fly Differential Analysis[EB/OL]. [2026-10-26]. [https://yzhddding.github.io/publications/](https://yzhddding.github.io/publications/).

<a id="ref-3"></a>

[3] Wang Yiyi, Yu Dongsong, Dong Ruiqi, et al. Bulbasaur: Branch-Guided Online Mutator Generation for Greybox Fuzzing[C/OL]//35th USENIX Security Symposium (USENIX Security 26). USENIX Association, 2026: 4089-4108. [https://www.usenix.org/conference/usenixsecurity26/presentation/wang-yiyi](https://www.usenix.org/conference/usenixsecurity26/presentation/wang-yiyi).

<a id="ref-4"></a>

[4] Chen Yiyang, Gui Nuoqi, Wang Long, et al. TrigFuzz: Triggering Conditions Guided Directed Fuzzing[C/OL]//2026 IEEE Symposium on Security and Privacy (SP). IEEE, 2026. [https://sp2026.ieee-security.org/accepted-papers.html](https://sp2026.ieee-security.org/accepted-papers.html).

<a id="ref-5"></a>

[5] Liu Yuwei, Deng Junquan, Jia Xiangkun, et al. PromeFuzz: A Knowledge-Driven Approach to Fuzzing Harness Generation with Large Language Models[C/OL]//Proceedings of the 2025 ACM SIGSAC Conference on Computer and Communications Security. New York: ACM, 2025: 1559-1573. [https://doi.org/10.1145/3719027.3765222](https://doi.org/10.1145/3719027.3765222).

<a id="ref-6"></a>

[6] Wang Kelin, Wang Yanhao, Xie Yuchong, et al. FirmHound: Discovering and Validating Firmware Vulnerabilities through Agentic Binary Reasoning[EB/OL]. [2026-10-26]. [https://weizhou.netlify.app/publication/firmhound-discovering-and-validating-firmware-vulnerabilities-through-agentic-binary-reasoning/](https://weizhou.netlify.app/publication/firmhound-discovering-and-validating-firmware-vulnerabilities-through-agentic-binary-reasoning/).

<a id="ref-7"></a>

[7] Wang Kelin, Chen Mengda, He Liang, et al. OSmart: Whitebox Program Option Fuzzing[C/OL]//Proceedings of the 2024 on ACM SIGSAC Conference on Computer and Communications Security. New York: ACM, 2024: 705-719. [https://doi.org/10.1145/3658644.3690228](https://doi.org/10.1145/3658644.3690228).

<a id="ref-8"></a>

[8] Sang Qian, Wang Yanhao, Liu Yuwei, et al. AirTaint: Making Dynamic Taint Analysis Faster and Easier[C/OL]//2024 IEEE Symposium on Security and Privacy (SP). IEEE, 2024: 3998-4014. [https://doi.org/10.1109/SP54263.2024.00045](https://doi.org/10.1109/SP54263.2024.00045).

<a id="ref-9"></a>

[9] DARKNAVY. DoGNAVY CyberGym Technical Report[R/OL]. 2026-08-05. [https://www.darknavy.org/blog/dognavy_cybergym_technical_report/](https://www.darknavy.org/blog/dognavy_cybergym_technical_report/).

<a id="ref-10"></a>

[10] Wang Zhun, Shi Tianneng, He Jingxuan, et al. CyberGym: Evaluating AI Agents' Real-World Cybersecurity Capabilities at Scale[PP/OL]. V3. arXiv(2026-03-24)[2026-10-26]. [https://arxiv.org/abs/2506.02548](https://arxiv.org/abs/2506.02548).

<a id="ref-11"></a>

[11] Wang Zhun, Schiller Nico, Li Hongwei, et al. ExploitGym: Can AI Agents Turn Security Vulnerabilities into Real Attacks?[PP/OL]. V1. arXiv(2026-05-11)[2026-10-26]. [https://arxiv.org/abs/2605.11086](https://arxiv.org/abs/2605.11086).

<a id="ref-12"></a>

[12] Wei Zichao, Zeng Jun, Wen Ming, et al. PATCHEVAL: A New Benchmark for Evaluating LLMs on Patching Real-World Vulnerabilities[PP/OL]. V1. arXiv(2025-11-14)[2026-10-26]. [https://arxiv.org/abs/2511.11019](https://arxiv.org/abs/2511.11019).
