/**
 * 将主题包的仓库版维护手册同步到文档站，避免两份文档长期漂移。
 *
 * 背景：
 * - 维护手册的“唯一真相”是：`packages/theme/MAINTENANCE.md`
 * - 文档站需要一份可直接阅读的页面：`apps/docs/docs/theme-maintenance.md`
 *
 * 约定：
 * - `apps/docs/docs/theme-maintenance.md` 由本脚本生成，请勿手改；
 * - 需要更新文案时，只改 `packages/theme/MAINTENANCE.md`，然后执行：
 *   - `pnpm --filter docs sync:theme-docs`（只同步文档）
 *   - 或 `pnpm --filter docs build`（构建前会自动同步）
 *
 * 技术约束：
 * - 不引入任何第三方依赖，仅使用 Node 内置模块。
 */

/* eslint-disable no-console */
const fs = require('node:fs/promises');
const path = require('node:path');

/**
 * 去掉维护手册开头的一级标题（H1），避免文档站页面出现双标题。
 * - 仓库版通常以 `# ...` 开头
 * - 文档站页面会由脚本统一生成标题 `# 主题维护手册（@farm-design-system/theme）`
 */
function stripLeadingH1(markdown) {
  const normalized = String(markdown).replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  let index = 0;
  while (index < lines.length && lines[index].trim() === '') index += 1;

  if (index < lines.length && /^#\s+/.test(lines[index])) {
    index += 1;
    if (index < lines.length && lines[index].trim() === '') index += 1;
  }

  return lines.slice(index).join('\n').trimEnd() + '\n';
}

async function readTextIfExists(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw error;
  }
}

async function main() {
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const sourcePath = path.join(repoRoot, 'packages', 'theme', 'MAINTENANCE.md');
  const targetPath = path.join(repoRoot, 'apps', 'docs', 'docs', 'theme-maintenance.md');

  const source = await readTextIfExists(sourcePath);
  if (!source) {
    throw new Error(`[docs] 未找到主题维护手册源文件：${sourcePath}`);
  }

  const body = stripLeadingH1(source);
  const next = [
    '---',
    'title: 主题维护手册',
    'order: 2',
    'toc: content',
    '---',
    '',
    '# 主题维护手册（@farm-design-system/theme）',
    '',
    '> 本页由脚本从 `packages/theme/MAINTENANCE.md` 同步生成，请勿直接编辑。',
    '> 如需修改内容，请编辑 `packages/theme/MAINTENANCE.md`，再运行 `pnpm --filter docs sync:theme-docs`（或 `pnpm --filter docs build`）。',
    '',
    body
  ].join('\n');

  const current = await readTextIfExists(targetPath);
  if (current === next) {
    console.log('[docs] 主题维护手册已是最新，无需同步。');
    return;
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, next, 'utf8');
  console.log('[docs] 已同步主题维护手册：apps/docs/docs/theme-maintenance.md');
}

main().catch((error) => {
  console.error(String(error?.stack || error));
  process.exitCode = 1;
});
