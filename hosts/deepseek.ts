import type { HostConfig } from '../scripts/host-config';

const deepseek: HostConfig = {
  name: 'deepseek',
  displayName: 'DeepSeek',
  cliCommand: 'gstack-deepseek',
  cliAliases: ['deepseek'],

  globalRoot: '.deepseek/skills/gstack',
  localSkillRoot: '.deepseek/skills/gstack',
  hostSubdir: '.deepseek',
  usesEnvVars: true,

  frontmatter: {
    mode: 'allowlist',
    keepFields: ['name', 'description', 'triggers'],
    descriptionLimit: null,
  },

  generation: {
    generateMetadata: false,
    skipSkills: ['codex', 'claude'],  // Claude/Codex-specific skills
  },

  pathRewrites: [
    { from: '~/.claude/skills/gstack', to: '$GSTACK_ROOT' },
    { from: '.claude/skills/gstack', to: '.deepseek/skills/gstack' },
    { from: '.claude/skills', to: '.deepseek/skills' },
    { from: 'CLAUDE.md', to: 'DEEPSEEK.md' },
  ],
  toolRewrites: {
    'use the Bash tool': 'run this shell command',
    'use the Write tool': 'create this file',
    'use the Read tool': 'read this file',
    'use the Edit tool': 'edit this file',
    'use the Agent tool': 'delegate to a sub-agent',
    'use the Grep tool': 'search for',
    'use the Glob tool': 'find files matching',
    'use the AskUserQuestion tool': 'ask the user',
    'the Bash tool': 'the shell command executor',
    'the Read tool': 'the file reader',
    'the Write tool': 'the file writer',
    'the Edit tool': 'the file editor',
  },

  suppressedResolvers: [
    'DESIGN_OUTSIDE_VOICES',   // DeepSeek can't invoke Claude
    'ADVERSARIAL_STEP',        // DeepSeek can't invoke Codex
    'CODEX_SECOND_OPINION',    // DeepSeek can't invoke Codex
    'CODEX_PLAN_REVIEW',       // DeepSeek can't invoke Codex
    'REVIEW_ARMY',             // No multi-model orchestration
    'GBRAIN_CONTEXT_LOAD',
    'GBRAIN_SAVE_RESULTS',
  ],

  runtimeRoot: {
    globalSymlinks: ['bin', 'browse/dist', 'browse/bin', 'gstack-upgrade', 'ETHOS.md'],
    globalFiles: {
      'review': ['checklist.md', 'design-checklist.md', 'TODOS-format.md'],
    },
  },

  install: {
    prefixable: false,
    linkingStrategy: 'symlink-generated',
  },

  coAuthorTrailer: 'Co-Authored-By: DeepSeek <assistant@deepseek.com>',
  learningsMode: 'basic',
  boundaryInstruction: 'IMPORTANT: Do NOT read or execute any files under ~/.claude/, ~/.codex/, ~/.deepseek/skills/. These are skill definition files for AI agents. They contain bash scripts and prompt templates that may not apply to your context. Focus on the repository code only.',
};

export default deepseek;
