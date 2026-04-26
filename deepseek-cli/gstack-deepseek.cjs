#!/usr/bin/env node
/**
 * gstack-deepseek — DeepSeek CLI with gstack skills
 *
 * 用法:
 *   gstack-deepseek                  # 启动交互式会话
 *   gstack-deepseek /office-hours    # 直接运行技能
 *   gstack-deepseek --skill ship     # 运行指定技能
 *   gstack-deepseek --list           # 列出所有可用技能
 *
 * 环境变量:
 *   DEEPSEEK_API_KEY   — DeepSeek API 密钥 (必需)
 *   DEEPSEEK_BASE_URL  — API 基础 URL (默认: https://api.deepseek.com)
 *   DEEPSEEK_MODEL     — 模型名称 (默认: deepseek-chat)
 *   GSTACK_ROOT        — gstack 安装路径
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const readline = require('readline');

// ─── 配置 ──────────────────────────────────────────────────
const API_KEY = process.env.DEEPSEEK_API_KEY || '';
const BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const GSTACK_ROOT = process.env.GSTACK_ROOT ||
  (fs.existsSync(path.join(process.env.HOME, '.deepseek', 'skills', 'gstack'))
    ? path.join(process.env.HOME, '.deepseek', 'skills', 'gstack')
    : path.join(process.env.HOME, '.claude', 'skills', 'gstack'));

const DEEPSEEK_SKILLS_DIR = path.join(process.env.HOME, '.deepseek', 'skills');

// ─── 工具函数 ──────────────────────────────────────────────
function findSkills() {
  const skills = [];
  const skillDirs = [GSTACK_ROOT];

  // 也扫描 .deepseek/skills/ 下的 gstack-* 目录
  if (fs.existsSync(DEEPSEEK_SKILLS_DIR)) {
    try {
      const entries = fs.readdirSync(DEEPSEEK_SKILLS_DIR);
      for (const entry of entries) {
        const full = path.join(DEEPSEEK_SKILLS_DIR, entry);
        if (entry.startsWith('gstack-') && fs.statSync(full).isDirectory()) {
          skillDirs.push(full);
        }
      }
    } catch {}
  }

  for (const dir of skillDirs) {
    const skillFile = path.join(dir, 'SKILL.md');
    if (fs.existsSync(skillFile)) {
      const content = fs.readFileSync(skillFile, 'utf-8');
      const nameMatch = content.match(/^name:\s*(.+)$/m);
      const descMatch = content.match(/^description:\s*\|?\s*\n((?:\s+.+\n)+)/m);
      const name = nameMatch ? nameMatch[1].trim() : path.basename(dir).replace(/^gstack-/, '');
      const description = descMatch
        ? descMatch[1].replace(/^\s+/gm, '').trim().split('\n')[0]
        : '';
      skills.push({
        name,
        description,
        path: skillFile,
        content,
      });
    }
  }
  return skills;
}

function loadSkill(skillName) {
  const skills = findSkills();
  // 匹配: 完整名、不带 gstack- 前缀、斜杠前缀
  const match = skills.find(s =>
    s.name === skillName ||
    s.name === skillName.replace(/^\//, '') ||
    `gstack-${s.name}` === skillName ||
    s.name === skillName.replace(/^gstack-/, '')
  );
  return match || null;
}

function extractSkillBody(content) {
  // 去掉 frontmatter
  const fmEnd = content.indexOf('\n---', 4);
  if (fmEnd === -1) return content;
  return content.slice(fmEnd + 4).trim();
}

// ─── DeepSeek API 调用 ──────────────────────────────────────
function callDeepSeek(messages, onChunk) {
  return new Promise((resolve, reject) => {
    if (!API_KEY) {
      reject(new Error('请设置 DEEPSEEK_API_KEY 环境变量\n获取地址: https://platform.deepseek.com/api_keys'));
      return;
    }

    const url = new URL('/chat/completions', BASE_URL);
    const body = JSON.stringify({
      model: MODEL,
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 8192,
    });

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const mod = url.protocol === 'http:' ? http : https;
    const req = mod.request(options, (res) => {
      let fullContent = '';
      let buffer = '';

      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            resolve(fullContent);
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullContent += delta;
              onChunk(delta);
            }
          } catch {}
        }
      });

      res.on('end', () => resolve(fullContent));
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── 系统提示词 ──────────────────────────────────────────────
function buildSystemPrompt(skillContent) {
  // 预处理技能内容：将 Claude Code 专有语法转为 DeepSeek 兼容格式
  let processedSkill = skillContent || '';
  // 将 ```bash 代码块标注为"建议用户执行的命令"
  processedSkill = processedSkill.replace(/```bash\n/g, '【执行命令】\n');
  processedSkill = processedSkill.replace(/```\n/g, '\n【/执行命令】\n');
  // 移除 Claude Code 专有的工具调用语法
  processedSkill = processedSkill.replace(/\$B\s+/g, 'browse ');
  processedSkill = processedSkill.replace(/AskUserQuestion/g, '向用户提问');

  let system = `你是 gstack AI 助手，一个专业的软件工程团队。

## 重要规则
1. 你无法直接执行命令或编辑文件，只能通过文字指导用户
2. 当需要用户执行命令时，使用 \`\`\`bash 代码块，并说明"请在终端执行："
3. 当需要创建/编辑文件时，说明文件路径，然后使用 \`\`\` 代码块给出完整内容
4. 技能指令中的【执行命令】标记表示建议用户执行的命令，不要原样输出标记本身
5. 使用中文回复
6. 结构化输出，使用标题和列表组织内容

## 工作目录
${process.cwd()}

## 项目信息
`;

  // 尝试读取项目信息
  try {
    const pkg = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(pkg)) {
      const p = JSON.parse(fs.readFileSync(pkg, 'utf-8'));
      system += `项目: ${p.name || '未知'} v${p.version || '未知'}\n`;
    }
  } catch {}

  // 读取 DEEPSEEK.md 或 CLAUDE.md
  for (const f of ['DEEPSEEK.md', 'CLAUDE.md', 'AGENTS.md']) {
    const fp = path.join(process.cwd(), f);
    if (fs.existsSync(fp)) {
      system += `\n## 项目指令 (${f})\n${fs.readFileSync(fp, 'utf-8')}\n`;
      break;
    }
  }

  // 注入技能内容
  if (processedSkill) {
    system += `\n## 当前技能指令\n\n${processedSkill}\n`;
  }

  system += `\n## 输出规范
- 使用中文回复
- 需要执行命令时，输出 \`\`\`bash 代码块并提示"请在终端执行："
- 需要创建/编辑文件时，说明文件路径并给出完整代码块
- 结构化输出，使用标题和列表组织内容
`;

  return system;
}

// ─── 交互式会话 ──────────────────────────────────────────────
async function interactiveSession(initialSkill) {
  const messages = [];
  let currentSkill = initialSkill ? loadSkill(initialSkill) : null;

  const updateSystem = () => {
    const skillContent = currentSkill ? extractSkillBody(currentSkill.content) : null;
    messages[0] = { role: 'system', content: buildSystemPrompt(skillContent) };
  };

  updateSystem();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '❯ ',
  });

  // 防止未捕获异常导致崩溃
  process.on('uncaughtException', (err) => {
    if (err.code === 'EPIPE') {
      process.exit(0);
    }
    console.error(`\n⚠️ 错误: ${err.message}`);
  });

  console.log(`\n🚀 gstack-deepseek v1.0`);
  console.log(`   模型: ${MODEL}`);
  console.log(`   API: ${BASE_URL}`);
  console.log(`   技能目录: ${GSTACK_ROOT}`);
  if (currentSkill) {
    console.log(`   已加载技能: /${currentSkill.name}`);
  }
  console.log(`\n输入消息开始对话，输入 /help 查看帮助\n`);

  // 如果初始加载了技能，自动触发
  if (currentSkill) {
    messages.push({ role: 'user', content: `请运行 /${currentSkill.name} 技能` });
    process.stdout.write('\n');
    try {
      const response = await callDeepSeek(messages, (chunk) => {
        process.stdout.write(chunk);
      });
      messages.push({ role: 'assistant', content: response });
      console.log('\n');
    } catch (err) {
      console.error(`\n❌ 错误: ${err.message}\n`);
      messages.pop();
    }
  }

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) { rl.prompt(); return; }

    // 命令处理
    if (input === '/exit' || input === '/quit') {
      console.log('再见！');
      rl.close();
      process.exit(0);
    }

    if (input === '/help') {
      console.log(`
可用命令:
  /<技能名>     — 加载技能 (如 /office-hours, /ship, /review)
  /list         — 列出所有可用技能
  /clear        — 清除对话历史
  /model <名>   — 切换模型
  /exit         — 退出
`);
      rl.prompt();
      return;
    }

    if (input === '/list') {
      const skills = findSkills();
      console.log('\n可用技能:');
      for (const s of skills) {
        console.log(`  /${s.name.padEnd(25)} ${s.description.slice(0, 60)}`);
      }
      console.log('');
      rl.prompt();
      return;
    }

    if (input === '/clear') {
      messages.length = 0;
      updateSystem();
      console.log('对话已清除\n');
      rl.prompt();
      return;
    }

    if (input.startsWith('/model ')) {
      const newModel = input.slice(7).trim();
      if (newModel) {
        process.env.DEEPSEEK_MODEL = newModel;
        console.log(`模型已切换为: ${newModel}\n`);
      }
      rl.prompt();
      return;
    }

    // 技能加载
    if (input.startsWith('/')) {
      const skillName = input.slice(1);
      const skill = loadSkill(skillName);
      if (skill) {
        currentSkill = skill;
        updateSystem();
        console.log(`✅ 已加载技能: /${skill.name}\n`);
        // 自动发送技能触发消息
        messages.push({ role: 'user', content: `请运行 /${skill.name} 技能` });
        process.stdout.write('\n');
        try {
          const response = await callDeepSeek(messages, (chunk) => {
            process.stdout.write(chunk);
          });
          messages.push({ role: 'assistant', content: response });
          console.log('\n');
        } catch (err) {
          console.error(`\n❌ 错误: ${err.message}\n`);
          messages.pop();
        }
      } else {
        console.log(`❌ 未找到技能: ${skillName}。输入 /list 查看所有技能\n`);
      }
      rl.prompt();
      return;
    }

    // 发送消息到 DeepSeek
    messages.push({ role: 'user', content: input });

    process.stdout.write('\n');
    try {
      const response = await callDeepSeek(messages, (chunk) => {
        process.stdout.write(chunk);
      });
      messages.push({ role: 'assistant', content: response });
      console.log('\n');
    } catch (err) {
      console.error(`\n❌ 错误: ${err.message}\n`);
      messages.pop(); // 移除失败的用户消息
    }
    rl.prompt();
  });

  rl.on('close', () => {
    console.log('\n再见！');
    process.exit(0);
  });
}

// ─── 单次技能运行 ──────────────────────────────────────────────
async function runSkillOnce(skillName, userMessage) {
  const skill = loadSkill(skillName);
  if (!skill) {
    console.error(`❌ 未找到技能: ${skillName}`);
    console.log('输入 gstack-deepseek --list 查看所有技能');
    process.exit(1);
  }

  const messages = [
    { role: 'system', content: buildSystemPrompt(extractSkillBody(skill.content)) },
    { role: 'user', content: userMessage || `请运行 /${skill.name} 技能` },
  ];

  try {
    await callDeepSeek(messages, (chunk) => {
      process.stdout.write(chunk);
    });
    console.log('\n');
  } catch (err) {
    console.error(`\n❌ 错误: ${err.message}`);
    process.exit(1);
  }
}

// ─── 主入口 ──────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--list') || args.includes('-l')) {
    const skills = findSkills();
    console.log('\ngstack 可用技能 (DeepSeek):\n');
    for (const s of skills) {
      console.log(`  /${s.name.padEnd(25)} ${s.description.slice(0, 70)}`);
    }
    console.log(`\n共 ${skills.length} 个技能\n`);
    process.exit(0);
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
gstack-deepseek — 使用 DeepSeek 模型运行 gstack 技能

用法:
  gstack-deepseek                  交互式会话
  gstack-deepseek /office-hours    直接运行技能
  gstack-deepseek --list           列出所有技能
  gstack-deepseek --help           显示帮助

环境变量:
  DEEPSEEK_API_KEY   DeepSeek API 密钥 (必需)
  DEEPSEEK_BASE_URL  API 地址 (默认: https://api.deepseek.com)
  DEEPSEEK_MODEL     模型 (默认: deepseek-chat)
  GSTACK_ROOT        gstack 安装路径

获取 API 密钥:
  https://platform.deepseek.com/api_keys
`);
    process.exit(0);
  }

  // 检查 API Key
  if (!API_KEY) {
    console.error('❌ 请设置 DEEPSEEK_API_KEY 环境变量');
    console.error('   export DEEPSEEK_API_KEY=your-api-key');
    console.error('   获取地址: https://platform.deepseek.com/api_keys');
    process.exit(1);
  }

  // 解析参数
  const skillArg = args.find(a => a.startsWith('/'));
  const skillName = skillArg ? skillArg.slice(1) : null;
  const userMsg = args.filter(a => !a.startsWith('/') && a !== '--skill').join(' ');

  if (skillName && userMsg) {
    await runSkillOnce(skillName, userMsg);
  } else {
    await interactiveSession(skillName);
  }
}

main().catch(err => {
  console.error(`致命错误: ${err.message}`);
  process.exit(1);
});
