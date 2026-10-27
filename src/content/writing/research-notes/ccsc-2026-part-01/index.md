---
title: "CCSC 2026 研究札记 · 看懂代码，也要知道什么叫错"
description: "程序分析、Specification、FM-Agent 与软件供应链风险。"
locale: zh-CN
date: 2026-10-26
dateLabel: "2026/10/26 整理"
draft: false
tags: [CCSC2026, 软件安全, 智能体]
noteKind: reading
series:
  id: ccsc-2026
  title: CCSC 2026 研究札记
  order: 1
---

程序分析能告诉我们程序做了什么，但判断它有没有安全问题，还得知道它本来应该做什么。这几场报告放在一起，我更关注的是这两件事怎样接起来：安全规约从哪里来，候选问题又靠什么证据确认。

这里整理了张源老师的多语言程序分析、王肇国老师的 FM-Agent、吴月明老师关于软件供应链与克隆漏洞语义的简短讨论，以及刘烃老师从产业研发视角谈到的供应链风险。

## 大模型驱动的多语言代码漏洞挖掘：程序分析为骨架，LLM 补足语义



**复旦大学 张源**


张源老师的报告《大模型驱动的多语言代码漏洞挖掘技术》是这次大会里我听得最认真的报告之一。相比"把代码交给大模型，让它直接找漏洞"这种直观思路，这套工作的整体框架要复杂得多。我的理解是，它最核心的设计原则其实很朴素：**不要试图让大模型取代程序分析，而是让大模型和传统程序分析各做自己更擅长的事情。**


程序分析擅长控制流、数据流、调用关系、指针关系等结构化、确定性的事实；大模型则更适合处理代码语义、业务知识、漏洞描述以及一些很难完整形式化的上下文。二者结合以后，目标不是简单得到一个"模型认为这里有漏洞"的结论，而是形成从候选发现、程序分析、语义推理一直到漏洞验证的完整链条。这种分工方式其实并不新奇。近几年不少 LLM4Sec 工作都在走类似路线：大模型提供传统静态分析很难获得的语义信息，传统程序分析则负责约束和验证大模型的推理结果。相比纯 LLM 或纯静态分析，我也更认可这种组合。


![大模型与程序分析的协同框架](/images/ccsc-2026/image9.png)



这张图很适合作为整节的总图。可以把这种分工粗略写成：


$$
\begin{gathered}
\text{LLM} \approx \text{Semantic~Reasoner} \\
\text{Program~Analysis} \approx \text{Structural~/~Symbolic~Evidence~Provider}
\end{gathered}
$$



最后再通过分析工具和实际执行不断约束结论。真正困难的问题于是从："大模型能不能分析代码？"变成了：**哪些问题应该交给大模型，哪些问题应该交给确定性的程序分析，又怎样让二者共享上下文和分析结果？**


---

### 多语言分析：统一表示，但不能抹掉语言语义


多语言漏洞检测首先面临一个很现实的问题：同一种漏洞，在不同语言甚至不同框架中的实现方式可能完全不同。报告举出的例子里，同一类根因可能分别出现在 Java、Python、PHP、JavaScript 等不同实现中。如果直接把源码转成自然语言再交给 LLM，虽然表面上绕开了语言差异，但又会产生另一个问题：<strong>自然语言摘要很容易损失程序执行所依赖的精确语义。</strong>例如：


- 运算符的真实含义；
- 变量和对象之间的关系；
- 控制流和数据依赖；
- 隐式调用；
- 框架参数绑定。


这些东西一旦在"代码 → 自然语言"的过程中被抹平，后续分析就很难再恢复。因此他们采用的思路是先通过 AST 把不同语言降低到一个**统一的中间表示**，在统一表示之上构造程序分析。


![多语言适配与统一 IR](/images/ccsc-2026/image10.png)



可以粗略理解成：


$$
\begin{matrix}
Java & & \\
Python & \searrow & \\
JavaScript & \rightarrow AST \rightarrow GIR \rightarrow Analysis & \\
PHP & \nearrow & 
\end{matrix}
$$



这里统一的并不是"各种语言长得一样"，而是：**不同语言在执行层最终可以归约到一组相对通用的语义操作。**


比如赋值、调用、条件分支、对象访问、返回等。复旦系统软件与安全实验室后来公开的 LIAN 框架[\[1\]](#ref-1)、[\[2\]](#ref-2)也采用了相当一致的思路：它提供一个通用中间表示 GIR，在此基础上实现统一的指针分析、数据流分析和污点分析；截至 2026-10-16 的公开 master 分支已支持 Java、Python、JavaScript、PHP、TypeScript、Go 等多种静态和动态语言。但有个边界：



$$
\text{Unified~IR} \neq \text{Lowest~Common~Denominator}
$$



统一 IR 并不意味着把所有语言压缩成一个"最低公共子集"。如果这样做，反而会丢掉安全分析中最重要的语言语义。例如 JavaScript 的：


- 原型链；
- 动态对象属性；
- 高阶函数；


以及 Spring、MyBatis 等框架里的：


- 参数绑定；
- 隐式入口；
- 框架回调；
- 隐式调用关系；


都不是简单 AST 归一化以后自然就能解决的。所以报告接下来又专门补了一层**语言与框架特性建模**。


![语言特性、框架特性与跨语言分析图](/images/ccsc-2026/image11.png)



我觉得这里真正有价值的不是"支持了多少种语言"，而是下面这个设计：


$$
\boxed{\text{Common~Abstraction} + \text{Language~/~Framework-specific~Semantics}}
$$



<strong>也就是"求同存异"。</strong>统一的是分析接口和底层语义，不是强行把各种语言的特殊行为抹掉。这类基础设施实现起来其实相当复杂，会后我查了一下，LIAN 可以作为理解这一部分的补充材料：其核心思路包括通用中间表示、状态化抽象解释、跨过程状态摘要等。


---

### 程序分析与 LLM 的按需协同


有了统一的程序分析底座以后，下一个问题变成：**什么时候真的需要 LLM？**报告并没有选择"所有函数都交给 LLM"。相反，它首先把局部程序分析结果沉淀成可以复用的**程序语义摘要**，其中可以包含数据流、调用关系、路径条件、安全约束等信息。


![程序语义知识摘要](/images/ccsc-2026/image12.png)



随后再由多个 Agent 协同完成分析。报告里的角色大致包括：


```text
静态分析 Agent
↓
CFG / CG / Source-Sink 等确定性分析
LLM 摘要 Agent
↓
处理复杂方法，生成条件化的程序语义摘要
复杂度预测 Agent
↓
预测当前任务的分析难度
↓
调度 Agent
↓
决定后续使用哪种分析能力
```


![复杂度预测与 Agent 按需调度](/images/ccsc-2026/image13.png)



整体思想可以概括成：


$$
\text{Cheap~Analysis} \rightarrow \text{Context~Enrichment} \rightarrow \text{LLM-assisted~Analysis}
$$



简单任务尽量让程序分析直接完成；任务变复杂后，再逐步增加上下文甚至调用 LLM。从资源分配角度看，这个设计很合理。因为通常来说，调用 LLM 的花费是通常要高于传统静态分析开销的。而且很多简单的数据流、调用关系和局部控制流问题，本来就没有必要让大模型参与、大模型也并不擅长这类问题。


#### 但我对"复杂度预测 → 决定分析策略"这一步有一些保留


这部分也是我听完整场以后最存疑的地方。假设一个任务的真实难度是：


$$
D(x)
$$



复杂度预测 Agent 得到：


$$
\hat{D}(x)
$$



再根据：


$$
\pi\left( \hat{D}(x) \right)
$$



决定后续到底使用轻量静态分析、更多上下文还是 LLM。这里存在一个天然的问题：<strong>复杂度预测本身是否足够可靠？</strong>如果一个简单问题被误判为复杂问题，通常只是多花了一些算力；但反过来，如果真正困难的问题被判断成简单问题：


$$
D(x) = High,\,\hat{D}(x) = Low
$$



后续系统就可能在能力不足的分析路径上直接结束。这类 **false-low** 比较危险，因为它影响的不只是效率，而可能影响漏洞召回率，因此我比较关心：**如果一开始判断错了，系统后面有没有机会意识到"我刚才低估了这个问题"，重新选择分析策略？**从报告展示的内容来看，我能看到很清楚的复杂度感知调度策略，但没有看到足够明确的**误判纠偏机制**。所以我会把它叫做：**复杂度感知自适应升级**而不会直接等同于更一般的"渐进式分析"。我个人更偏好另一种更加"Agent Loop"控制思路：


$$
\text{Analyze} \rightarrow \text{Execute~/~Observe} \rightarrow \text{Collect~Feedback} \rightarrow \text{Refine~Analysis} \rightarrow \ldots
$$



也就是让**真实分析结果和运行反馈反过来决定下一步需要什么能力**，而不是主要依赖一次预先的复杂度判断。前者更像：先判断这个问题有多难，再决定用什么工具。后者更像：先分析和尝试，根据真实遇到的障碍决定下一步需要补什么能力。我会更喜欢后一种"反馈闭环式"的设计。如果说得尖锐一点，这套方案给我的感觉仍然比较像：**以现有程序分析框架为主体，在若干传统组件难以处理的位置引入 LLM。**


因此它更接近 **AI 强化的程序分析**，而不是完全从 Agent 的观察、决策和工具调用机制重新设计出来的 AI-native 系统。不过这只是我从报告架构得到的一点见解，并不能据此断言哪一种方案一定更好。安全分析本来就非常重视确定性、可重复性和分析成本；把大部分简单任务留给传统程序分析，也完全可能是更现实的工程选择。这两种方法大概也很难有谁对谁帕累托占优，真正需要实验回答的是：**这两种调度策略相对优劣究竟何在，分别适用于什么场景？**


---

### 再往上一层：给传统程序分析增加"业务安全语义"


报告里我觉得另一个很有意思的部分，是它没有停留在：


$$
Source \rightarrow Sink
$$



而是继续尝试回答：<strong>即使数据真的沿着这条路径流过去了，为什么它在业务上是一个漏洞？</strong>这是传统控制流、数据流分析经常会碰到的瓶颈。例如：


```java
Order order = repo.findById(id);
if (order.ownerId != currentUser.id) {
    reject();
}
return order;
```


CFG 完全可以分析：


```text
        ownerId == userId ?
          /           \
        yes            no
         ↓              ↓
       return         reject
```

这个简化例子假设 `reject()` 会终止当前请求，例如抛出异常；如果它只是记录拒绝后返回，程序仍可能继续执行 `return order`。在上述假设下，拥有者通过检查并返回订单，其他用户被拒绝。


如果我们已经告诉分析器：


$$
Read\left( u,r \right) \Rightarrow Owns\left( u,r \right)
$$



那么传统路径分析完全可以检查：


$$
Path_{\text{return}} \vDash Owns\left( u,r \right)
$$



这里的 $\vDash$可以理解成：



<strong>"这条执行路径满足后面的安全规则"。</strong>真正困难的问题其实是：<strong>谁告诉程序分析器 Read(u,r) ⇒ Owns(u,r) 是这里应该遵守的规则？</strong> CFG 能告诉我们"程序怎么走"，却不会天然知道："用户原则上只能读取属于自己的订单。"因此报告又引入了一层安全实体与业务语义建模。


![安全实体识别](/images/ccsc-2026/image14.png)



系统先试图从代码中识别：


$$
Subject,\text{~}Resource,\text{~}Credential,\text{~}Session,\ldots
$$



例如：

```text
user    → 访问主体
session → 身份上下文
token   → 身份凭据
order   → 受保护资源
```

然后进一步抽象这些实体之间的安全关系。


![业务安全语义推测](/images/ccsc-2026/image15.png)



报告中主要包括三类：


$$
\begin{gathered}
\text{访问控制语义} \\
\text{实体生命周期语义} \\
\text{访问路径上下文语义}
\end{gathered}
$$



例如可以抽象出：


$$
Read\left( u,r \right) \Rightarrow Owns\left( u,r \right)
$$



或者：


$$
SensitiveOperation \Rightarrow Authenticated(session)
$$



再或者：


$$
Refund(order) \Rightarrow state(order) \in \left\{ P,aidShipped \right\}
$$



此时传统程序分析重新发挥作用：


$$
\text{Semantic~Rule} + \text{Path~Analysis} \rightarrow \text{Rule~Violation}
$$



所以我现在会把这一部分理解成：<strong>在传统程序分析上再叠加一个"安全语义 / 安全规约层"。</strong>传统程序分析负责回答：<strong>程序实际上做了什么？</strong>语义层则尝试回答：<strong>程序按业务安全原则本来应该做什么？</strong>漏洞往往就存在于：


$$
\text{Actual~Behavior} \neq \text{Expected~Security~Semantics}
$$



这并不是用 LLM 替代控制流分析，恰恰相反：


$$
\boxed{\text{Semantic~Rule~Inference} + \text{Traditional~Program~Analysis}}
$$



上层负责产生 specification，下层负责检查 specification。这也是为什么这种方法更有希望解决传统 Source-Sink 分析比较难处理的**逻辑漏洞**。


---

### 从 N-Day 中学习的不是"漏洞文本"，而是"漏洞规则"


报告后面还有一块我开始没完全理解，后来才觉得比较有意思：<strong>利用 N-Day 漏洞和安全补丁补充可复用的安全知识。</strong>最浅层的做法当然可以是：


```text
CVE 描述
↓
向量化
↓
RAG
↓
找相似漏洞
```


但这里做的事情明显更进一步。


![基于 N-Day 描述生成与优化规则](/images/ccsc-2026/image16.png)



首先从 CVE / N-Day 描述中提取：


- 漏洞入口；
- 攻击条件；
- 关键 API；
- 调用关系；
- 数据依赖；
- 安全语义。


比如一个路径遍历漏洞，CVE 描述可能只有：用户可控的文件名缺乏正确校验，攻击者可以读取目录外文件。最开始可以得到一个很粗的候选规则：


$$
UserInput \rightsquigarrow FileRead
$$



并怀疑中间缺少：


$$
PathValidation
$$



但自然语言描述并不足以形成真正可靠的程序分析规则。因此下一步要回到**已知存在漏洞的原始程序**里，通过 CFG、调用图、数据流等分析恢复真实漏洞链：


```text
HTTP 参数
↓
路径构造
↓
若干包装函数
↓
文件读取
```


再确认：


$$
\neg Normalize
$$



以及：


$$
\neg BoundaryCheck
$$



那么原本 CVE 资料中模糊的自然语言："路径校验不足"就可以逐渐精化成：


$$
UserControlledPath \rightsquigarrow FileRead \land \neg Normalize \land \neg BoundaryCheck
$$



这里程序分析承担的并不是再次"发现这个已知 CVE"，而是：**把自然语言描述中的漏洞知识 ground 到真实代码上，并校准这个结构化规则是否真的刻画了漏洞根因。**


---

### Patch 又提供了一次很有价值的对照


光看漏洞版本仍然可能误解漏洞根因。所以报告又进一步利用安全补丁。


![基于安全补丁抽取漏洞根因](/images/ccsc-2026/image17.png)



假设漏洞代码：


```text
File f = new File(BASE, input);
return read(f);
```


补丁变成：


```text
File f = new File(BASE, input);
Path p = f.toPath().normalize();
if (!p.startsWith(BASE_PATH)) {
throw new SecurityException();
}
return read(p);
```


那么通过：


$$
P_{vuln}\,vs\,P_{fixed}
$$



可以发现修复新增了归一化和边界检查，于是就有更充分的证据认为这两个条件正是该漏洞缺失的安全约束，整个过程可以写成：


$$
D_{CVE} \rightarrow R_{0}
$$



先由漏洞描述形成粗规则 $R_{0}$，然后：



$$
Analyze\left( P_{vuln},R_{0} \right) \rightarrow R_{1}
$$



通过漏洞程序对其进行 grounding 和 refinement，再：


$$
Diff\left( P_{vuln},P_{fixed} \right) \rightarrow \Delta C
$$



从补丁差分中获得新增加的安全约束，最终：


$$
R^{*} = Refine\left( R_{1},\Delta C \right)
$$



形成可以迁移到其他程序的通用的、结构化的规则。


![新安全规则的发现与应用](/images/ccsc-2026/image18.png)



所以这里真正想做的是：


$$
\boxed{\text{CVE~Instance} \rightarrow \text{Root~Cause} \rightarrow \text{Security~Constraint} \rightarrow \text{Reusable~Detection~Rule}}
$$



也就是：<strong>从 N-Day 中学习"为什么这是一个漏洞"，而不仅仅记住"这里曾经出现过一个漏洞"。</strong>有了规则以后，再分析新的程序：


```text
String p = request.getParameter(\"file\");
return Files.readString(Paths.get(BASE, p));
```


如果程序分析发现：


$$
UserControlledPath \rightsquigarrow FileRead
$$



同时：


$$
\neg Normalize \land \neg BoundaryCheck
$$



系统就可以认为它重新出现了同一种安全约束缺失，这样 N-Day 知识才真正完成了"举一反三"。


---

### 最后一步：怎么减少误报？


这也是我茶歇时专门问张源老师的问题。我的问题大意是：<strong>大模型做漏洞检测以后，怎么避免 FP，也就是误报？</strong>他的回答大致分成三种：第一，人工核验；\
第二，使用程序分析，例如判断某条漏洞路径实际上是不是不可达；\
第三，搭建运行环境，必要时使用 Mock，真实运行生成的 PoC，观察漏洞对应的副作用是否真的发生。


我觉得这个回答其实很好地把不同"证据等级"区分开了。最弱的一层可能只是 LLM 自己判定存在漏洞。再进一步就是静态 Candidate 条目，然后是程序分析可行性、静态 Candidate PoC 构建，直到最后的动态执行和真实环境副作用观测。换句话说："模型觉得像漏洞""静态存在路径""生成了一段看起来像 PoC 的代码"都只是中间证据。如果条件允许，真正强的证据还是：<strong>PoC 在足够接近真实的软件环境里运行，并确确实实产生了与安全属性违反相一致的副作用。</strong>报告后面也展示了针对 Java Web 漏洞的动态验证和 PoC 生成。


![Java 漏洞动态验证](/images/ccsc-2026/image19.png)



这里我也有一个没有完全解决的疑问，如果真实环境难以完整搭建：


```text
真实依赖太复杂
↓
Mock 外部组件
↓
PoC 成功执行
```


那么其实**可执行性是不等于现实可利用性**的，至少还需要继续考虑两个问题：


$$
E_{mock} \approx E_{real}\text{~}?
$$



也就是 Mock 环境是否保留了真正影响漏洞触发的约束，以及：


$$
O(execution) \Rightarrow SecurityViolation\text{~}?
$$



观察到的副作用是否真的足以证明安全属性被破坏，所以 Mock 是非常有价值的工程手段，但也需要关注**环境保真度**。


---

### 我对这套框架最后的理解


如果把整个报告重新组织一下，我觉得它其实可以放在一条很清楚的轴上：


$$
\boxed{\text{Recall} \rightarrow \text{Reasoning} \rightarrow \text{Validation}}
$$



前端通过：

```text
统一 IR
+ 语言 / 框架特性
+ 静态程序分析
+ N-Day 安全知识
```

尽量让真正重要的问题进入分析范围，中间通过：

```text
Program Analysis
+ LLM Semantic Reasoning
+ Agent Collaboration
```

完成更复杂的代码理解和漏洞推理，最后则通过：

```text
程序分析确认 → PoC 生成 → 动态执行 → 安全副作用验证
```

逐步提高漏洞结论的可信度。其中我最认可的，是两个基本思想。


第一：<strong>LLM 和程序分析不是替代关系，而应该是互补关系。</strong>第二：**传统程序分析缺少的未必只是更强的数据流算法，有时真正缺的是"这里本来应该满足什么安全规则"。**因此，在程序分析之上增加一个能够理解安全实体、业务规则和漏洞知识的**语义层**，是我觉得这套工作的另一个重要方向。

相对而言，我对基于"复杂度预测"预先决定后续分析策略这一部分更加保留。它当然可以降低分析成本，但也引入了一个新的关键假设：<strong>系统首先必须准确知道当前问题到底有多难。</strong>如果这一判断本身不可靠，而且后续又缺少纠偏机制，那么一次错误的路由可能直接导致后续分析能力不足。相比这种一次性路由，我个人还是更喜欢一种更加动态的思路：**让系统在真实分析和执行过程中不断获得反馈，再根据当前遇到的问题决定下一步需要什么能力。**


不过这更多是架构偏好的差异。报告本身选择"静态分析为主、复杂情况再调用大模型"，从确定性、成本和工程可控性的角度也有充分理由。最终是否更好，还是应该由实验回答，而不是由架构审美决定。

## FM-Agent：先定义“什么叫对”，再去找“哪里错”



**上海交通大学 王肇国**

公开实现：[\[3\]](#ref-3)。


王肇国老师介绍的 FM-Agent[\[4\]](#ref-4)，是这次报告里让我觉得比较新鲜的一项工作。如果只看结果，它当然也可以被概括成用大模型检查大型软件系统里的 Bug。但我觉得这样会把最有意思的地方说没。FM-Agent 真正改变的是问题的提法，普通的大模型 Code Review 更像是在直接问：**"这段代码有没有问题？"**而 FM-Agent 在这之前先插入了一层：**"这段代码本来应该满足什么？"**


也就是 **Specification（规约）**。思路可以写成：

```text
开发者意图 → 规范文档 → 实现检查 → 潜在缺陷 → 执行验证
```

这里的 Specification 就成了开发者意图和程序真实实现之间的桥梁。


![FM-Agent 规约生成、代码推理与漏洞诊断](/images/ccsc-2026/image20-ccsc2026.png)



---

### 为什么 Specification 这么重要


这一点其实来自传统形式化验，Hoare Logic 中最经典的表示是：


$$
\left\{ P \right\}\text{~}C\text{~}\left\{ Q \right\}
$$



其中：


- $P$：前置条件；
- $C$：程序或程序片段；
- $Q$：后置条件。



它表示：


如果执行 $C$之前满足 $P$，那么 $C$正常执行结束以后应该满足 $Q$。



例如：


$$
\left\{ x > 0 \right\}\,y: = x + 1\,\left\{ y > 1 \right\}
$$



这里"代码是否正确"并不是一个悬空的问题，而是：


$$
Implementation \vDash Specification\text{~}?
$$



其中 $\vDash$ 可以理解成：



<strong>实现是否满足这份规约。</strong>传统形式化验证的基本流程也非常清楚：


```text
Specification
\+
Implementation
↓
Verifier
↙ ↘
Correct Bug / Proof Failure
```


![形式验证中的规约与实现](/images/ccsc-2026/image21-ccsc2026.png)



问题在于：<strong>Specification 从哪里来？</strong>这反而是大型软件形式化验证很现实的瓶颈。如果一个系统有几千个函数，让人给每个函数都写精确的形式化前置条件、后置条件和循环不变量，成本会非常高。论文也把大规模组合推理的核心障碍之一归结为传统 specification 的人工负担。于是 FM-Agent 做了一个很有意思的取舍：**不要求所有 Specification 一开始就是严格的逻辑公式，而是允许用自然语言表达。**


---

### 自然语言 Specification：牺牲一部分严格性，换取可扩展性


这一点是我听报告时印象最深的地方之一，传统形式化规约的优势当然非常明显：


$$
P(x) \equiv x > 0 \land x < 100
$$



这样的公式没有什么歧义，可以直接交给 SMT Solver 或证明器，但代价也同样明显：想让大语言模型稳定地为一个十几万行代码库里的几千个函数生成完整、严格、可证明的形式规约，本身就是非常困难的任务。


上一节讨论 LLM 与程序分析分工时其实已经碰到类似的问题：LLM 擅长处理语义和自然语言，但不应该假设它天然擅长完成所有严格的符号推理工作。论文自己的理由更加直接：**开发者的设计意图本来就大量存在于自然语言中**，例如需求文档、设计说明，以及现在 coding agent 接收到的 prompt。而现有 verifier 却主要要求形式公式，因此中间存在一个很明显的表示鸿沟。所以 FM-Agent 选择将传统形式化的 Specification 变成自然语言形式的 Specification，例如不一定写：


$$
result \neq null \land result.type = Keyword
$$



而可以写：如果输入字符串是一个合法的 C 关键字，函数应该返回对应的 TokenKind；否则返回 None。


![自然语言规约与形式规约的取舍](/images/ccsc-2026/image22-ccsc2026.png)



这是一种非常明显的 trade-off，FM-Agent 不是说："自然语言比形式公式更好。"，而更接近：<strong>如果目标是把 Specification 扩展到大型系统，先让 LLM 用它更擅长的自然语言承载契约，是一种更现实的选择。</strong>而且它也并没有彻底放弃形式方法。论文中提到，如果某个自然语言条件足够精确，可以进一步让 LLM 把它翻译成公式，再使用 SMT 求解器检查证明义务；若翻译生成的公式中包含大量未解释函数，说明这个自然语言概念本身还不够精确，就继续保留自然语言推理。所以我更愿意把它理解成：


$$
\text{Natural~Language} \leftrightarrow \text{Formal~Formula}
$$



不是二选一，而是一条连续谱。<strong>能形式化的部分尽量落回形式工具，难形式化的部分再让 LLM 承担。</strong>这一点我比较喜欢。


---

### 更妙的一步：不要从可能存在 bug 的实现里反推 Specification


如果只是：

```text
Function Implementation
↓
LLM
↓
Specification
```


马上会出现一个很麻烦的循环，假如实现本身就是错的：


$$
Implementation_{buggy} \rightarrow Specification_{buggy}
$$



那么随后再检查：


$$
Implementation_{buggy} \vDash Specification_{buggy}
$$



很可能什么问题都发现不了，因为错误实现已经把自己的错误"解释"进 Specification 里了。报告里专门用一个 C 编译器中的 from_keyword 函数说明这个问题。这个函数负责判断字符串是不是 C 关键字。为了提高效率，实现里先检查首字符：


```text
let first = s.as_bytes()[0];
if !matches!(first, \... ) {
return None;
}
```


问题在于，这个 fast-reject 的字符集合本身写错了，会把一些合法 C 关键字错误过滤掉，例如 nullptr。如果直接根据这段实现生成 Specification，LLM 很容易认为<strong>只有以这几个字符开头的字符串才可能是合法关键字。</strong>于是 Bug 自己污染了规约。


论文的实验例子正是用来说明：使用 implementation 驱动生成的 specification 可能继承 implementation 的错误。


![从错误实现生成规约的风险](/images/ccsc-2026/image23-ccsc2026.png)



---

### Caller 驱动的 Specification：从"别人期待你做什么"恢复函数契约


FM-Agent 最让我觉得巧妙的地方，就是它换了一个视角：<strong>不要主要问一个函数"你自己做了什么"，而去看调用它的人"期待它做什么"。</strong>假设：


$$
F_{1} \rightarrow F_{2}
$$



其中 $F_{1}$调用了 $F_{2}$。FM-Agent 定义：



$$
F_{1} \vdash \left\{ P \right\} F_{2}\left\{ Q \right\}
$$



表示从 caller $F_{1}$的角度来看，它期望 $F_{2}$满足前置条件 $P$和后置条件 $Q$。这里有两个非常自然的信息来源。



#### 前置条件：看 caller 怎么调用


例如：

```text
x = parse_number("123")
```

caller 实际上传入的是一个合法数字字符串。那么可以推断：


$$
P:input\text{~应该是合法数字字符串}
$$



#### 后置条件：看 caller 后面怎么使用结果


例如：

```text
user = load_user(uid)
send_mail(user.email)
```

虽然 load_user() 自己可能没有任何注释，但 caller 已经隐含要求：


$$
user \neq null
$$



以及：


$$
user.email\text{~必须可用}
$$



否则后续逻辑就无法成立。也就是说：<strong>caller 的使用方式本身，就是一种隐式 Specification。</strong>这也是我觉得 FM-Agent 最妙的思想。


![从调用者生成函数规约](/images/ccsc-2026/image24-ccsc2026.png)



### 期望 Specification


论文把这种来自 caller 的期待单独定义成：


$$
F_{1} \vdash \left\{ P \right\} F_{2}\left\{ Q \right\}
$$



其中：


- $P$：$F_{1}$ 在调用 $F_{2}$之前保证成立的条件；
- $Q$：$F_{1}$ 在调用 $F_{2}$以后依赖的条件。



论文原文的定义更加严格：


caller 的实现确保调用 callee 之前程序状态满足 $P$，而 caller 后续代码要求 callee 返回以后程序状态满足 $Q$。



这实际上是在用"使用上下文推理隐式契约"，而不是看 Implementation来总结自描述规约。


### 多个 Caller 时怎么办？


实际系统里一个函数当然可能被很多地方调用。假设：


$$
\begin{gathered}
F_{1} \vdash \left\{ P_{1} \right\} F\left\{ Q_{1} \right\} \\
F_{2} \vdash \left\{ P_{2} \right\} F\left\{ Q_{2} \right\}
\end{gathered}
$$



从形式上，可以把它理解成：


$$
P_{F} = P_{1} \vee P_{2}
$$



因为 callee 可能出现在任意一种合法调用上下文中。而后置条件则要同时满足不同 caller 的期待：


$$
Q_{F} = Q_{1} \land Q_{2}
$$



论文也用这个公式解释多个 caller 的 Specification 合并，不过实际实现中，因为 $P_{i},Q_{i}$是自然语言，不是形式公式，所以并不是简单字符串拼一个"或"和"且"，而是由 LLM 理解并合并其中的语义。



这个设计有一个我觉得很有意思的含义：**函数的"正确行为"不再完全由自己定义，而是由它在整个系统中承担的角色共同定义。**


---

### 从系统入口向下传播：自顶向下的Specification


既然内部函数的 Specification 来自 caller，那么自然就形成了一个自顶向下的过程。


```text
System Entry
↓
F1
/ \\
F2 F3
\\ /
F4
```


先理解系统入口：这个系统整体应该做什么？再从 caller 对 callee 的期待，逐层往下传播。


![自顶向下的规约传播](/images/ccsc-2026/image25-ccsc2026.png)



于是就有：

```text
系统意图 → 入口 Spec → 调用方预期 → 内部函数 Spec
```

论文的一个核心论点是：对 LLM 自动生成的软件来说，自顶向下尤其重要，因为开发者未必真正理解每个内部函数的实现；如果反过来从底层实现向上总结，则很容易被本身可能有问题的 Implementation 误导。这和人工写 Specification 时不太一样，人工开发者可能非常熟悉自己写的底层函数，所以 bottom-up 或 top-down 都能做。但到了 Coding Agent 时代：


<strong>代码的作者甚至可能没有任何人完整读过这份代码。</strong>这时"系统整体想干什么"反而比"某个内部函数到底应该干什么"更容易获得。所以从全局意图逐层细化成局部契约，就变得比较自然。


---

### Code Reasoner：用 Hoare逻辑的结构约束 LLM 推理


有了 Specification 以后，下一步才真正开始检查实现。FM-Agent 并不是直接问："这段代码符合 Spec 吗？"而是借用了 Hoare Logic 的推理结构。假设：


$$
\left\{ P \right\}\text{~}C\text{~}\left\{ Q \right\}
$$



FM-Agent 从 $P$ 开始，对代码块逐步推导执行后的状态：



$$
P_{0}\overset{C_{1}}{\rightarrow}P_{1}\overset{C_{2}}{\rightarrow}P_{2} \rightarrow \cdots \rightarrow P_{n}
$$



其中：


- $P_{0}$：Specification 给出的前置条件；
- $C_{i}$：代码块；
- $P_{i}$：执行该代码块以后，LLM 推导出的自然语言后置条件。



最后检查：


$$
P_{n} \vDash Q_{spec}\text{~}?
$$



其中 $\vDash$表示"能够推出 / 满足"。



如果：


$$
P_{n} \not\vDash Q_{spec}
$$



那么说明当前这条执行路径得到的实际行为，无法满足 Specification 要求的行为。于是报告：**Potential Bug**报告里的 from_keyword 就是这个过程。某条路径到：


```text
return None;
```


能够推出的只是输入字符串首字符不属于 fast-reject 列表，函数返回 None。但 Specification 需要只有真正不是合法 C 关键字时，才应该返回 None。前者无法推出后者：


$$
Q_{path} \not\vDash Q_{spec}
$$



于是这一行就成为潜在违反点。


![关键词判断函数的规约推理示例](/images/ccsc-2026/image26-ccsc2026.png)



---

### 为什么我觉得"Hoare-style"比"多想几轮"更有意思


很多 Agent Code Review 最终还是：

```text
读代码
↓
自由推理
↓
觉得这里可能有 Bug
```

FM-Agent 则给 LLM 加了一层明确的推理骨架：


$$
\begin{gathered}
\left\{ P \right\} C_{1}\left\{ R \right\} \\
\left\{ R \right\} C_{2}\left\{ Q \right\}
\end{gathered}
$$



从而：


$$
\left\{ P \right\} C_{1};C_{2}\left\{ Q \right\}
$$



也就是说，每一步都在维护：<strong>执行到这里，程序状态应该是什么。</strong>我觉得这里真正新鲜的地方不是"大模型学会了形式化验证"，而是：<strong>把形式方法里的 proof structure 当成 LLM 的 reasoning scaffold。</strong>相比单纯增加更多 Agent、更多轮思维链，这种显式结构至少提供了一套稳定的中间接口。Specification 也是如此，它本身就是一个可以被：生成、检查、更新、传递和易于人类阅读的中间产物。


---

### 关于"系统规模"上的取舍


但它并不等于传统意义上的形式化验证，这一点必须说清楚。因为 FM-Agent 虽然借用了 Hoare Logic：


$$
\left\{ P \right\} C\left\{ Q \right\}
$$



但它的 $P,Q$很多时候是**自然语言**，中间状态也是由 LLM 推导出来的自然语言。因此它无法提供传统形式化验证器所具备的可靠性保证。论文明确指出：FM-Agent 的目标是可扩展推理，而非取代具备可靠性保证的传统形式化 verifier，所以更准确的称呼应该是：



**Hoare-style / formal-method-inspired reasoning**而不是"对十几万行代码完成了严格形式化验证。"，这一点我觉得反而让这项工作更容易理解。<strong>它做的是一个在形式化严谨性和系统规模上的取舍：</strong>传统 verifier 更靠左，FM-Agent 更靠右。


---

### 最后的 Execution Validation：推理只产生假设，执行才提供更强证据


FM-Agent 最后一步的Bug Validator 我非常熟悉<strong>。</strong>前面的推理只说明：


$$
Implementation \not\vDash Specification
$$



但这个不匹配仍然可能来自：


- Specification 本身不准确；
- LLM 推理错误；
- 路径理解错误；
- 模型自身幻觉。


因此还是老样子，**candidate bug 不等于comfirmed bug**。FM-Agent 会进一步根据推理过程生成系统级测试用例：


```text
Potential Bug
↓
Generate Test Case
↓
Execute on Real System
↓
Observe Result
↓
Confirmed / Unconfirmed
```


![生成系统级测试验证候选漏洞](/images/ccsc-2026/image27-ccsc2026.png)



论文实验中，一个潜在 Bug 最多尝试生成 10 次测试用例。如果始终无法触发，就标记为 unconfirmed，而不是作为真正 Bug 报告。不同系统的 Oracle 也不一样，例如编译器可以使用差分测试：


$$
Program \rightarrow Compiler_{target}
$$



同时：


$$
Program \rightarrow GCC
$$



然后比较：


$$
Output_{target}\quad Output_{reference}
$$




数据库系统也可以拿 DuckDB 一类参考实现做对照；没有参考 implementation 时，则使用 Specification 中描述的期望结果判断。这个思路和上一节讨论漏洞去误报时其实完全一致：<strong>Reasoning 负责产生假说，execution 负责增加证据。</strong>或者写成：


$$
\begin{gathered}
\text{Reasoning} \rightarrow \text{潜在Bug} \\
\text{Execution} \rightarrow \text{Bug~证据}
\end{gathered}
$$



我越来越觉得，这几场报告虽然方法差别很大，但最后经常都会落回这一点：**静态或语义推理可以告诉我们"哪里值得怀疑"，真正强的漏洞或 Bug 证据仍然来自可观察的执行结果。**


---

### Specification 也不是绝对可靠的


FM-Agent 把 Specification 放到了整个系统的中心，但这也意味着：<strong>Specification 一旦错了，后面的结构化推理也会跟着错。</strong>作者已经解决了一个很重要的问题：


$$
Buggy\text{~}Implementation \not\Rightarrow \,Specification
$$



也就是尽量不让 callee 自己错误的实现污染自己的规约。但 caller 也不是绝对可信的。例如：


```text
Buggy Caller
↓
Wrong Expectation
↓
Wrong Specification
```


仍然可能发生。多个 caller 的期待也可能：


- 不完整；
- 互相矛盾；
- 只覆盖部分运行场景。


自然语言 Specification 本身也可能存在歧义。因此这套方法其实不是消灭了"不确定性"，而是把原来"LLM 直接判断代码有没有 Bug"这种很难观察的不确定性，转移到了一个更加显式的中间产物：<strong>Specification 到底写得对不对？</strong>从工程角度看，我反而觉得这是进步。因为 Specification 是一个可以被：


- 人阅读；
- 比较；
- 修正；
- 验证；


的 artifact。至少错误不会完全藏在 Agent 的自由推理过程里。


---

### 为什么它能够扩展到大型系统


FM-Agent 还能分析十万行以上的系统，并不是因为把几十万行代码一次塞进上下文，关键仍然是**组合推理和契约化解耦**。如果每个函数都有自己的契约：


$$
\begin{gathered}
F_{1}:\left\{ P_{1} \right\} F_{1}\left\{ Q_{1} \right\} \\
F_{2}:\left\{ P_{2} \right\} F_{2}\left\{ Q_{2} \right\} \\
\ldots
\end{gathered}
$$



组合推理让上层函数依据被调用函数的契约进行局部分析，减少反复展开下游实现的需要，但这并不自动给出“整体验证从指数级降为线性”的复杂度保证。论文第 4.2 节对调用图求强连通分量（SCC），缩点得到 DAG，再按入口到被调用函数的方向自顶向下分层生成规约；同一 SCC 内的规约同时生成。同层可并发处理，但递归 SCC 内仍有依赖，不能说同层所有函数互不依赖。第 5 节再以函数契约为上下文并发推理。[\[4\]](#ref-4)


论文第 9.1 节表 1 列出四个评估系统，总规模约 27.7 万行、8549 个函数，最大系统 CCC 为 14.3 万行；摘要与结果部分报告发现了 522 个此前未发现的 Bug。[\[4\]](#ref-4)这些是作者评测所报，并非我的独立复现。对我来说，可扩展性的依据仍是下面这一点：<strong>Specification 把一个超大系统拆成了一组可以独立处理、又可以组合起来的局部契约。</strong>这才是它能够扩展的基础。


---

### 我最后真正记住的三个点


听完整个报告以后，我对 FM-Agent 的记忆其实非常集中。


### 1. 自然语言也可以成为 Specification


过去提到 Specification，我会自然想到严格公式：


$$
\left\{ P \right\} C\left\{ Q \right\}
$$



FM-Agent 给出的思路是：如果严格形式 Specification 成了规模化瓶颈，那就先使用 LLM 和人都容易表达、理解的自然语言 Specification。这降低了严格性，却换来了：


- 自动生成；
- 大规模覆盖；
- 可读性；
- 与自然语言 Developer Intent 的直接连接。


并且：**自然语言不是终点。能形式化的地方，仍然可以重新落回 SMT 和传统形式方法。**


### 2. 从"别人期待你做什么"恢复 Specification


这是我觉得最巧妙的一点。传统的思路往往是使用 implementation 直接构建 Specification，容易让错误实现污染 Specification。而FM-Agent 换成：


$$
Caller\text{ 期望 + 领域知识} + Implementation \rightarrow Specification
$$



尤其是：


$$
F_{1} \vdash \left\{ P \right\} F_{2}\left\{ Q \right\}
$$



这个表示很好地表达了一个常见但很少显式写出来的事实：<strong>函数的契约，往往就藏在别人怎么调用它、怎么使用它的返回结果里面。</strong>这是一种从软件结构本身恢复 Developer Intent 的方式。


### 3. Specification 和推理都不是最终证据，最后还是要执行


无论前面的 reasoning 多漂亮：


$$
Implementation \not\vDash Specification
$$



仍然只能算潜在的 Bug。最终还是：


$$
\text{Generate} \rightarrow \text{Execute} \rightarrow \text{Observe}
$$



把判断落到真实系统。所以这项工作最后形成了一个我很喜欢的组合：


$$
\boxed{\text{Specification} + \text{结构化}\text{Reasoning} + \text{Execution}\text{  }\text{验证}}
$$



Specification 定义"什么叫对"；Hoare-style reasoning 定位"哪里可能不对"；真实执行再回答它到底是不是真的错了。如果要用一句话概括 FM-Agent，我觉得不是"大模型自动做形式化验证。"，而是：<strong>它借用了形式方法的结构，让 LLM 先恢复程序应该满足的契约，再围绕这些契约进行组合推理，最后通过真实执行把推理得到的潜在 Bug 落到可观察证据上。</strong>这个范式，我觉得确实挺有意思。

## 大模型赋能的软件供应链安全：从静态依赖到漏洞语义



**华中科技大学 吴月明**


吴月明老师这一场主要讨论大模型如何参与软件供应链安全分析，这部分和我目前更关注的漏洞触发、程序分析、Fuzzing 等问题距离稍远一些，所以我听得没有前面几场那么细。整个报告覆盖了开源软件供应链风险、软件成分分析、生命周期感知依赖追踪、克隆漏洞检测，以及最后的多智能体未知漏洞挖掘。其中我觉得真正值得留下来的有两个点。



---

### 软件供应链不是一张静态的依赖图


传统软件成分分析通常会从：


- manifest
- lockfile
- SBOM
- 包管理器元数据


恢复软件依赖关系，最直观的表示是图：


$$
G = (V,E)
$$

其中：


- V：软件组件；
- E：组件之间的依赖关系。


这种表示隐含了一个假设：<strong>当前看到的依赖关系，足以代表最终运行的软件。</strong>但真实软件供应链并不是静止的，一个组件从源码进入最终运行环境，中间可能经历：


$$
Code \rightarrow Build \rightarrow Release \rightarrow Deploy \rightarrow Runtime
$$



不同阶段里：


- 依赖可能被解析成不同版本；
- 组件可能被打包、裁剪或者合并；
- 部分依赖只存在于构建期；
- 某些运行时组件反而不会直接出现在源码依赖声明里。


报告因此强调，传统基于单一快照的 SCA / SBOM 很难完整反映组件在整个生命周期中的来源、传播和最终去向。如果把传统 SBOM 写成：


$$
G_{static} = (V,E)
$$



那么生命周期感知的表示更接近：


$$
\mathcal{G} = \left\{ G_{t} \mid t \in Lifecycle \right\}
$$



其中：


$$
t \in \left\{ Code,Build,Release,Deploy,Runtime \right\}
$$



也就是说**组件依赖本身也是随软件生命周期演化的状态。**


![生命周期感知的软件成分分析](/images/ccsc-2026/image46.png)



报告中的 SCA-Agent 会沿软件生命周期收集不同阶段的证据，再通过跨阶段组件推理恢复：


- 组件从哪里进入系统；
- 在后续阶段如何传播；
- 最终是否仍存在于部署或运行环境。


我觉得这里最值得记住的不是具体的 Agent 编排，而是：<strong>供应链分析不能只问"这个依赖现在在不在"，还要问"它从哪里来、经过了什么阶段、最后去了哪里"。</strong>这和前面 AgentDoS 中"生命周期决定攻击策略"的思想虽然是两个完全不同的问题，但有一个相似点：当系统状态会随时间演化以后，单个静态快照往往不够。



---

### 克隆漏洞检测：代码相似，不代表漏洞也相同


这一场对我更有意思的部分，是后面的**克隆漏洞检测**。虽然我并不熟悉这一块，但是基本问题并不复杂。假设我们已经知道一段代码存在漏洞：


$$
C_{v}
$$



然后在其他项目中发现一段非常类似的代码：


$$
C_{c}
$$



传统克隆漏洞检测会计算：


$$
Sim\left( C_{v},C_{c} \right) > \theta
$$



是否成立，如果是，那就把它作为潜在的克隆漏洞。相似性可以来自：


- Token；
- AST；
- 代码结构；
- embedding。


问题是代码相似性并不能推导出漏洞等价性，报告也指出，传统克隆检测虽然能够找到大量结构相似的代码，但很难进一步判断**这些代码是否真的保留了原漏洞成立所需要的安全语义。**



#### 一个简单例子


假设已知漏洞代码是：


```text
if (len < MAX) {
    memcpy(dst, src, user_len);
}
```


真正的问题并不在：


```text
memcpy(...)
```


这个 API 本身，而在于 user_len 没有被约束到：


$$
user\_ len \leq sizeof(dst)
$$



现在另一个项目里出现：


```text
if (len < MAX) {
    if (user_len > sizeof(dst)) {
        return ERROR;
    }

    memcpy(dst, src, user_len);
}
```


两段代码：


- Token 很像；
- AST 很像；
- 控制结构也很像。


甚至可以有：


$$
Sim_{AST}\left( C_{v},C_{c} \right) \approx 1
$$



但第二段已经增加：


$$
user\_ len \leq sizeof(dst)
$$



这一安全约束。所以它们是语法级代码克隆，而并非漏洞克隆。这也是为什么我觉得这里真正需要比较的不是："两段代码长得像不像？"而是：**"决定漏洞成立的安全条件是否也一起被复制过去了？"**



---

### 先便宜筛选，再做昂贵的语义判断


报告里的方案并没有直接把整个代码库交给大模型判断，而是先利用一系列传统方法逐步缩小候选集：


```text
已知漏洞代码
    ↓
Bloom Filter
    ↓
Token Filter
    ↓
AST Filter
    ↓
少量候选
    ↓
LLM 语义验证
```


![克隆漏洞的多步筛选与语义验证](/images/ccsc-2026/image47.png)



其中前面的 Bloom、Token 和 AST 主要负责高通量候选样本筛选，后面的 LLM 才负责语义级验证。报告下一页把三级过滤进一步展开：先通过布隆过滤器进行大规模快速筛选，再利用 Token 和 AST 相似度逐步提高结构匹配精度，最后只把一个较小的候选集合交给语义验证阶段，这个<strong>"从低成本粗粒度筛选到高开销语义级分析"</strong>的结构其实已经很熟悉了，它和前面张源老师讲的多语言漏洞挖掘有很强的共同思想：**传统程序分析负责压缩搜索空间和提供确定性事实，大模型负责处理更难形式化的语义判断。**


而不是让 LLM 从头扫描整个代码库。



#### LLM 真正要判断的是"漏洞语义是否保持"


如果只做代码克隆检测，问题是：


$$
Does\,C_{c}\,look\,like\,C_{v}?
$$



加入语义验证以后，真正想问的是：


$$
Does\,C_{c}\,preserve\,the\,vulnerability\,semantics\,of\,C_{v}?
$$



例如同样是从 source 到 sink 输入流入危险函数，但候选代码里可能新增 Sanitizer，或者权限检测、边界条件等等，和原始漏洞已经不是同一种语义。这其实和前面"业务语义层"的讨论也有一点相似，传统结构分析告诉我们程序之间有什么结构关系，更上一层的安全语义则继续问：<strong>真正决定漏洞成立的约束有没有发生变化？</strong>所以可以把整个检测过程理解成：


$$
\text{Structural~Similarity} \rightarrow \text{Security-semantic~Similarity}
$$




---

### 但 Semantic Verification 本身仍然不是漏洞证明


这里我还是会保留一个和前文一致的想法，即使 LLM 最后判断：


$$
C_{c} \approx_{semantic}C_{v}
$$



也不能直接推出 c 里面一定有漏洞存在，因为 LLM 的语义判断仍然可能被影响：


- 上下文不足；
- 路径理解错误；
- sanitizer 识别错误；
- hallucination；


所以大语言模型语义一致性不等于漏洞的形式证明，如果要进一步提高证据强度，最终仍然可能需要回到之前反复提到的：


$$
\text{Control~Flow} + \text{Data~Flow} + \text{Path~Constraints} + \text{Dynamic~Validation}
$$



去确认那些真正决定漏洞成立的条件是否确实存在。这和前面几场报告反复出现的原则其实没有变化：


**LLM 非常适合做语义理解、候选筛选和 hypothesis generation；真正强的漏洞结论，最好仍然建立在程序事实或执行证据上。**


吴月明讨论组件的生命周期与漏洞语义；下面保留刘烃从产业研发视角记录的风险引入、研发传播和使用触发，作为供应链部分的补充。

## AI 开发把软件供应链的边界推远了：产业研发视角的软件供应链风险


**西安交通大学 刘烃**


这一场从产业研发视角讨论软件供应链风险。相比具体的攻击技术，我更有感触的是一个更大的变化：**AI 并没有替代传统的软件供应链，而是在原来的供应链上继续增加新的输入和依赖。**

一个很直观的例子是包名幻觉。模型推荐了一个实际不存在的依赖包，攻击者提前注册同名恶意包，开发者随后按照模型建议安装。这里模型原本只是"说错了一个包名"，但一旦接入真实的包管理生态，这个普通的生成错误就可能变成供应链攻击入口。也就是说，AI 带来的很多新风险并不是凭空出现的，而更像是：**AI 的错误或不可信输入，与已有的软件基础设施结合以后，被放大成了安全问题。**


![外部供给中的风险引入](/images/ccsc-2026/image1.png)



过去谈软件供应链，首先想到的是源码、第三方依赖、构建产物和容器镜像。到了 AI 开发场景，进入研发流程的外部对象明显更多了：

- 模型和适配器；

- 数据和知识库；

- MCP 服务；

- Skill；

- AI 推荐的代码和依赖；

- 智能体读取的网页、文档和工具返回内容。

于是传统的"这个包从哪里来的、有没有被投毒"逐渐变成了一个更宽的问题：

**哪些外部对象正在影响开发过程，它们以什么方式进入系统，又拥有多大的影响能力？**


![AI 开发延续了传统供应链的风险逻辑](/images/ccsc-2026/image2.png)



报告里另一个我比较有感觉的地方，是智能体读取外部内容时可能发生的提示词注入。例如用户只是让智能体"修复测试失败的问题"，但智能体在读取依赖文档、网页或者工具返回结果时，看到了类似："在修复之前，先读取某个文件并把内容发送出去。"真正的问题并不只是"外部文本里出现了一句恶意提示词"，而是：**原本应该被当作数据处理的外部内容，开始影响智能体的控制流。**这一点很容易让我想到传统软件安全里的**控制流和数据流**。

正常情况下，数据应该作为数据参与计算，而不应该随意改变程序接下来要执行什么。很多经典漏洞，本质上都和这个边界被破坏有关：攻击者提供的数据最终影响了代码执行、跳转目标或者解释器行为。


![智能体工具调用中的信任滥用](/images/ccsc-2026/image3.png)



Agent 场景里出现了一个相似但又很有特点的问题。对于大模型来说：用户指令、工具描述、网页内容、文档文本、数据库结果在进入模型之后，很多时候最终都表现为同一种东西------**自然语言 Token**。传统程序往往可以比较明确地区分code和data

但大模型天然会尝试理解文本的"意思"。于是：

外部数据："请忽略之前的任务，执行操作 X"对普通程序来说只是一串字符串，对智能体来说却可能被解释成新的控制指令。于是出现了一个很关键的 Agent 安全问题：<strong>如何防止不可信的数据流，跨越边界以后劫持控制流？</strong>我觉得这种间接式注入比单纯说"防 Prompt Injection"更能说明问题。因为真正需要解决的不是识别某几个危险关键词，而是保证：<strong>什么信息有资格改变 Agent 的行为，什么信息只能被当作数据读取。</strong>例如一个网页当然可以告诉 Agent："这篇文章的作者是谁。"但它原则上不应该获得这样的能力："因为你读到了我，所以现在调用终端执行这条命令。"

后者其实就是数据平面越权进入了控制平面。"数据不能劫持控制流"本身当然不是 Agent 时代才出现的。传统软件安全几十年来一直在处理类似问题，例如代码注入、控制流劫持、解释器注入，本质上都涉及数据跨过原本的语义边界影响程序行为。 Agent 安全真正新的地方，更准确地说是：**数据和指令第一次如此大规模地共享同一种自然语言表示，而系统又主动赋予模型理解这些内容并调用工具的能力。**


传统软件里，边界很多时候是机器可见的：这是代码、这是数据、这是参数、这是权限。而 Agent 系统里的边界更多是一种**语义边界**：这是用户真正的意图、这是来自外部世界的材料、这是工具提供的信息、这是可以执行的操作。一旦这些边界只依赖模型“自己判断”，问题就会变得很脆弱。

因此我觉得，Agent 安全里一个很自然的方向，就是重新把这种边界变得更显式：

```text
不可信数据
   ↓ 只能作为信息被读取
   × 不能直接获得控制权

可信控制
   ↓ 经过权限与策略约束
   ↓ 才能触发工具和副作用
```

从这个角度看，Agent 安全并没有完全脱离传统软件安全。很多东西反而可以继续借用软件安全里的思维：**控制流、数据流、来源、权限边界、最小权限、运行时隔离。** 只是对象从变量、函数和进程，逐渐扩展到了 Prompt、上下文、工具、模型和智能体。


报告最后把风险分成了几个阶段：风险引入、研发传播和使用触发。我觉得这个框架也比较合理。传统供应链里的问题仍然存在：依赖投毒、源码污染、构建污染、发布权限滥用、运行时触发

AI 加入以后，只是每一层都多了一些新的东西：

```text
风险引入：依赖包 → 模型、数据、工具、Skill
研发传播：恶意源码 → 不安全生成代码、恶意指令借助 Agent 权限传播
使用触发：传统漏洞 → 模型后门、工具滥用、智能体越权操作
```

所以与其说 AI 重新发明了一套供应链安全，不如说：<strong>AI 把软件供应链的边界继续向模型、数据和智能体延伸，同时把传统供应链问题带进了一个权限更强、自动化程度更高的执行环境。</strong>而这里面我最感兴趣的一个问题，还是前面的那句话：<strong>怎样让数据始终只是数据，而不是在某个环节悄悄变成了控制指令。</strong>这可能也是 Agent 安全与传统软件安全之间，一个非常自然的连接点。

## 结语：先问行为，再问规约，最后问证据

把这几场报告放在一起看，我觉得程序分析和大模型的分工还是要说清楚。程序分析提供可以复核的程序行为，安全实体、业务规则和 Specification 尝试描述预期的安全要求，LLM 在这里更像是在两者之间补充语义、提出假设、压缩搜索空间。这几个环节各有作用，哪一个都不能单独支撑完整的结论。

所以看到一个候选漏洞时，我觉得还是要先问：路径真的可达吗？安全条件确实缺失吗？规约有可靠的上下文依据吗？放到尽可能接近真实的环境里执行，能不能观察到一致的违反结果？代码相似、模型判断和结构化推理都有价值，但还需要继续用程序事实和可观察的证据来核对。

## 参考资料

<a id="ref-1"></a>

[1] 复旦大学系统软件与安全实验室. 技术分享｜LIAN——通用高精度代码安全分析技术[EB/OL]. (2025-10-18)[2026-10-26]. [https://secsys.fudan.edu.cn/news/content/2025-10-18-001/](https://secsys.fudan.edu.cn/news/content/2025-10-18-001/).

<a id="ref-2"></a>

[2] FDU-SSR. The Lian Program Analysis Framework[CP/OL]. [2026-10-26]. [https://github.com/FDU-SSR/lian](https://github.com/FDU-SSR/lian).

<a id="ref-3"></a>

[3] fmagent-project. FM-Agent[CP/OL]. [2026-10-26]. [https://github.com/fmagent-project/FM-Agent](https://github.com/fmagent-project/FM-Agent).

<a id="ref-4"></a>

[4] Ding Haoran, Wang Zhaoguo, Chen Haibo. FM-Agent: Scaling Formal Methods to Large Systems via LLM-Based Hoare-Style Reasoning[PP/OL]. V2. arXiv(2026-06-18)[2026-10-26]. [https://arxiv.org/abs/2604.11556](https://arxiv.org/abs/2604.11556).
