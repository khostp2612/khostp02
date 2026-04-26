# gstack-deepseek — 在中国使用 gstack 的完整方案

> gstack 原版依赖 Claude Code（Anthropic API），在中国无法直接使用。
> 本项目在 gstack 基础上添加了 **DeepSeek** 支持，无需翻墙即可使用。

## 快速开始

### 前置要求

- [Bun](https://bun.sh/) v1.0+
- [Node.js](https://nodejs.org/) v18+
- [DeepSeek API Key](https://platform.deepseek.com/api_keys)（国内可注册，无需翻墙）

### 安装

```bash
# 1. 克隆项目
git clone https://github.com/你的用户名/gstack-deepseek.git
cd gstack-deepseek

# 2. 安装依赖并构建
bun install
bun run build

# 3. 安装为 DeepSeek 宿主
./setup --host deepseek

# 4. 设置 API Key
export DEEPSEEK_API_KEY=sk-your-api-key-here

# 5. 开始使用！
gstack-deepseek /office-hours
```

### 一行命令安装

```bash
git clone https://github.com/你的用户名/gstack-deepseek.git ~/gstack-deepseek && \
cd ~/gstack-deepseek && bun install && bun run build && ./setup --host deepseek
```

## 使用方法

### 交互式会话

```bash
export DEEPSEEK_API_KEY=sk-xxx
gstack-deepseek
```

进入交互界面后：

```
❯ /office-hours          ← 加载"YC 办公时间"技能
❯ /plan-ceo-review       ← CEO 审查
❯ /plan-eng-review       ← 工程审查
❯ /review                ← 代码审查
❯ /qa                    ← QA 测试
❯ /ship                  ← 发布
❯ /list                  ← 列出所有技能
❯ /help                  ← 帮助
❯ /exit                  ← 退出
```

### 直接运行技能

```bash
gstack-deepseek /office-hours
gstack-deepseek /review
gstack-deepseek /ship
```

### 列出所有技能

```bash
gstack-deepseek --list
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥（必需） | — |
| `DEEPSEEK_BASE_URL` | API 基础 URL | `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | 模型名称 | `deepseek-chat` |
| `GSTACK_ROOT` | gstack 安装路径 | 自动检测 |

### 使用 DeepSeek V3

```bash
export DEEPSEEK_MODEL=deepseek-chat
gstack-deepseek /office-hours
```

### 使用第三方 API 代理

```bash
export DEEPSEEK_BASE_URL=https://your-proxy.com
export DEEPSEEK_API_KEY=your-key
gstack-deepseek
```

## 可用技能

| 技能 | 命令 | 说明 |
|------|------|------|
| 办公时间 | `/office-hours` | 产品构思、六个关键问题 |
| CEO 审查 | `/plan-ceo-review` | 战略方向审查 |
| 工程审查 | `/plan-eng-review` | 架构与技术评审 |
| 设计审查 | `/plan-design-review` | UI/UX 设计评审 |
| 自动审查 | `/autoplan` | 一键自动完成所有审查 |
| 代码审查 | `/review` | 代码质量审查 |
| QA 测试 | `/qa` | 自动化测试 |
| 发布 | `/ship` | 测试+提交+创建PR |
| 安全审计 | `/cso` | OWASP + STRIDE |
| 调试 | `/investigate` | 系统化根因分析 |
| 文档更新 | `/document-release` | 自动更新项目文档 |
| 学习记忆 | `/learn` | 管理跨会话知识 |
| 健康检查 | `/health` | 代码质量仪表板 |

## 与原版 gstack 的区别

| 特性 | gstack (原版) | gstack-deepseek |
|------|--------------|-----------------|
| AI 模型 | Claude (Anthropic) | DeepSeek V3 |
| 网络要求 | 需翻墙 | 国内直连 |
| API 费用 | $3-15/百万 token | ¥1-2/百万 token |
| 文件操作 | 原生工具调用 | 通过代码块指导用户 |
| 浏览器测试 | `$B` 命令 | `$B` 命令（相同） |
| 技能完整度 | 100% | ~90%（跳过 Claude/Codex 专属技能） |

## 工作流程

```
思考 → 计划 → 构建 → 审查 → 测试 → 发布

/office-hours → /autoplan → 写代码 → /review → /qa → /ship
```

## 常见问题

### Q: 需要翻墙吗？
不需要。DeepSeek API 在中国可以直接访问。

### Q: 费用多少？
DeepSeek API 价格约为 ¥1/百万输入 token、¥2/百万输出 token。日常使用每天约 ¥0.5-2。

### Q: 和 Claude Code 版本有什么区别？
核心技能提示词相同。主要区别是 DeepSeek 没有原生的文件读写工具，所以需要用户手动执行命令。技能的审查方法论、检查清单等完全一致。

### Q: 可以用其他模型吗？
可以。修改 `DEEPSEEK_MODEL` 环境变量即可。兼容 OpenAI API 格式的模型都可以使用（如 Qwen、GLM 等），只需设置 `DEEPSEEK_BASE_URL`。

## 许可证

MIT（与原版 gstack 相同）
