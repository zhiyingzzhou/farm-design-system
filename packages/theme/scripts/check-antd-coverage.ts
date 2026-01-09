/**
 * 检查「Finex key -> antd」映射覆盖情况。
 *
 * 背景：
 * - 主题源是 Finex Token（Figma/Token Studio 导出）
 * - 我们不再维护 Farm 自己的语义化 token；业务组件与 @farm-design-system/ui 统一复用 antd token
 * - 因此需要一个脚本快速判断：当前 finex-ui 里有哪些 key 没被 antd 侧消耗到（global/components）
 *
 * 用法：
 * - `pnpm --filter @farm-design-system/theme check:antd:coverage`
 * - 严格模式（用于 CI）：`pnpm --filter @farm-design-system/theme check:antd:coverage -- --strict`
 *
 * 读懂输出：
 * - “未映射到 antd” 不等于 “错误”：
 *   - 有些设计 token 可能是预留色、或设计侧临时保留的状态色（antd 没有对应语义）
 *   - 这类 key 可以加入 `expectedUnusedFinexKeys` 并写清原因
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type FinexUiResolved = {
  light: Record<string, string>;
  dark: Record<string, string>;
};

type StringMap = Record<string, string>;
type ComponentsMap = Record<string, Record<string, string>>;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const srcRoot = path.join(packageRoot, 'src');
const adaptersRoot = path.join(srcRoot, 'adapters');

const finexUiPath = path.join(srcRoot, 'finex-ui.json');
const antdTokenMapPath = path.join(adaptersRoot, 'antd-token-map.json');
const antdComponentsMapPath = path.join(adaptersRoot, 'antd-components-map.json');

/**
 * 允许“暂不映射到 antd” 的 finex key。
 *
 * 说明：
 * - 这里的列表只用于“覆盖率检查”的输出与严格模式判定，不影响主题产物本身
 */
const expectedUnusedFinexKeys: Record<string, string> = {
  // 设计侧目前 Light/Dark 同值（#f9f9f9），注入到 antd 容易把 dark surface 拉亮；更适合作为业务侧的“浅灰提示底色”
  'Tips-Grey': 'Light/Dark 同值，暂不注入 antd（避免影响暗色表面）。',

  // antd 没有内置 “Warning Button” 这一标准语义（只有 primary/default/danger 等）
  'Button-Color-Warning-button-normal': '业务按钮状态色（antd 无对应语义）。',
  'Button-Color-Warning-button-Press': '业务按钮状态色（antd 无对应语义）。',
  'Button-Color-Warning-button-Disable': '业务按钮状态色（antd 无对应语义）。',

  // 与 normal 同值，但设计侧保留了 disable 这一槽位；如后续分离出独立色值再映射
  'Button-Color-Secondary-White-button-Disable': '与 normal 同值，暂不单独映射。'
};

function collectUsage(antdTokenMap: StringMap, antdComponentsMap: ComponentsMap): Map<string, string[]> {
  const usage = new Map<string, string[]>();

  function push(finexKey: string, from: string) {
    const list = usage.get(finexKey);
    if (list) list.push(from);
    else usage.set(finexKey, [from]);
  }

  for (const [antdToken, finexKey] of Object.entries(antdTokenMap)) {
    push(finexKey, `token.${antdToken}`);
  }

  for (const [componentName, tokenMap] of Object.entries(antdComponentsMap)) {
    for (const [componentToken, finexKey] of Object.entries(tokenMap)) {
      push(finexKey, `components.${componentName}.${componentToken}`);
    }
  }

  return usage;
}

function isStrictMode(argv: string[]): boolean {
  return argv.includes('--strict');
}

async function main() {
  const [finexUiRaw, antdTokenMapRaw, antdComponentsMapRaw] = await Promise.all([
    fs.readFile(finexUiPath, 'utf8'),
    fs.readFile(antdTokenMapPath, 'utf8'),
    fs.readFile(antdComponentsMapPath, 'utf8')
  ]);

  const finexUi = JSON.parse(finexUiRaw) as FinexUiResolved;
  const antdTokenMap = JSON.parse(antdTokenMapRaw) as StringMap;
  const antdComponentsMap = JSON.parse(antdComponentsMapRaw) as ComponentsMap;

  const finexLightKeys = Object.keys(finexUi.light ?? {});
  const finexDarkKeys = Object.keys(finexUi.dark ?? {});
  const darkSet = new Set(finexDarkKeys);
  const missingInDark = finexLightKeys.filter((key) => !darkSet.has(key));
  if (missingInDark.length > 0) {
    const preview = missingInDark.slice(0, 10).join(', ');
    throw new Error(
      `[theme] finex-ui.json: Light/Dark key 不一致（dark 缺少：${preview}${missingInDark.length > 10 ? ' ...' : ''}）`
    );
  }

  const allFinexKeys = finexLightKeys.sort();
  const usage = collectUsage(antdTokenMap, antdComponentsMap);

  // 先确保映射引用的 finex key 都存在
  for (const [finexKey, fromList] of usage.entries()) {
    if (!(finexKey in (finexUi.light ?? {}))) {
      throw new Error(`[theme] antd 映射引用了不存在的 finex key "${finexKey}"（来自：${fromList.join(', ')}）`);
    }
  }

  const unused = allFinexKeys.filter((key) => !usage.has(key));

  console.log(`[theme] finex key 总数：${allFinexKeys.length}`);
  console.log(`[theme] 被 antd 覆盖到的 finex key：${usage.size}`);

  if (unused.length === 0) {
    console.log('[theme] 所有 finex key 都已映射到 antd（global/components）。');
    return;
  }

  console.log('[theme] 以下 finex key 未映射到 antd：');
  for (const key of unused) {
    const reason = expectedUnusedFinexKeys[key];
    console.log(reason ? `- ${key}（${reason}）` : `- ${key}`);
  }

  if (isStrictMode(process.argv.slice(2))) {
    const unexpected = unused.filter((key) => !(key in expectedUnusedFinexKeys));
    if (unexpected.length > 0) process.exitCode = 1;
  }
}

await main();

