/**
 * 检查「Farm Token -> antd」映射覆盖情况。
 *
 * 背景：
 * - `Farm Token` 是主题包对外的稳定语义层（业务组件 / @farm-design-system/ui / Tailwind / CSS Vars 都只认它）
 * - antd 只是消费端之一：通过 `antd-token-map.json`（全局）+ `antd-components-map.json`（组件级）把 Farm Token 注入到 antd
 *
 * 为什么需要这个脚本：
 * - 设计侧（Figma/Token Studio）新增 token 后，如果没有同步到 antd 映射，UI 可能出现“部分组件还在用 antd 默认色阶”的割裂
 * - 但并不是所有 Farm Token 都必须映射到 antd：有些 token 只服务业务组件（例如特定业务按钮/图表色）
 *
 * 用法：
 * - `pnpm --filter @farm-design-system/theme check:antd:coverage`
 * - 严格模式（用于 CI）：`pnpm --filter @farm-design-system/theme check:antd:coverage -- --strict`
 *
 * 读懂输出：
 * - “未映射到 antd” 不等于“不能用”：
 *   - 这些 token 仍然会出现在 `tokens/cssVars/tailwind` 里，业务组件依然可以稳定消费
 *   - 这里只是在提醒：antd 这一端不会自动吃到它
 *
 * 当严格模式失败时（exit code = 1）：
 * 1) 如果这些 token 本来就不应该进 antd（业务专用/无对应语义），把它们加入 `expectedUnusedFarmTokens` 并写清原因
 * 2) 如果这些 token 确实应该影响 antd 外观，去改 `scripts/sync-src-assets.ts` 的映射规则（不要手改 json）
 *    - 全局：`buildAntdTokenMap`
 *    - 组件级：`buildAntdComponentsMap`
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type StringMap = Record<string, string>;
type ComponentsMap = Record<string, Record<string, string>>;

/**
 * ESM 脚本没有 Node 的 `__dirname`，这里用 `import.meta.url` 还原出“当前文件所在目录”。
 * 目的：保证脚本从任意工作目录执行都能定位到 `packages/theme/src/adapters/*`。
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const adaptersRoot = path.join(packageRoot, 'src', 'adapters');

const farmTokenMapPath = path.join(adaptersRoot, 'farm-token-map.json');
const antdTokenMapPath = path.join(adaptersRoot, 'antd-token-map.json');
const antdComponentsMapPath = path.join(adaptersRoot, 'antd-components-map.json');

/**
 * 允许“暂不映射到 antd” 的 Farm Token。
 *
 * 说明：
 * - 这些 token 仍会通过 `tokens/cssVars/tailwind` 对外暴露，可供业务组件/@farm-design-system/ui 使用
 * - 这里的列表只用于“覆盖率检查”的输出与严格模式判定，不影响主题产物本身
 */
const expectedUnusedFarmTokens: Record<string, string> = {
  // 设计侧目前 Light/Dark 同值（#f9f9f9），映射到 antd 容易把 dark surface 拉亮；更适合作为业务侧的“浅灰提示底色”
  'tips-grey': 'Light/Dark 同值，暂不注入 antd（避免影响暗色表面）。',

  // antd 没有内置 “Warning Button” 这一标准语义（只有 primary/default/danger 等），这些状态色主要留给业务按钮体系使用
  'button-color-warning-button-normal': '业务按钮状态色（antd 无对应语义）。',
  'button-color-warning-button-press': '业务按钮状态色（antd 无对应语义）。',
  'button-color-warning-button-disable': '业务按钮状态色（antd 无对应语义）。',

  // 与 normal 同值，但业务侧可能会把 “disable” 当作单独语义来消费（例如透明度/叠加层由业务控制）
  'button-color-secondary-white-button-disable': '业务组件使用（与 normal 同值，保留语义）。'
};

/**
 * 统计 “某个 Farm Token 被 antd 哪些配置引用到了”。
 *
 * - 全局 token：`token.xxx`
 * - 组件级 token：`components.Button.xxx`
 *
 * 返回：
 * - key：Farm Token
 * - value：引用路径列表（用于输出可读的定位信息）
 */
function collectUsage(antdTokenMap: StringMap, antdComponentsMap: ComponentsMap): Map<string, string[]> {
  const usage = new Map<string, string[]>();

  function push(token: string, from: string) {
    const list = usage.get(token);
    if (list) list.push(from);
    else usage.set(token, [from]);
  }

  for (const [antdToken, farmToken] of Object.entries(antdTokenMap)) {
    push(farmToken, `token.${antdToken}`);
  }

  for (const [componentName, tokenMap] of Object.entries(antdComponentsMap)) {
    for (const [componentToken, farmToken] of Object.entries(tokenMap)) {
      push(farmToken, `components.${componentName}.${componentToken}`);
    }
  }

  return usage;
}

/**
 * 是否开启严格模式。
 *
 * 严格模式用于 CI：
 * - 如果发现“未映射到 antd”的 Farm Token 且不在 `expectedUnusedFarmTokens` 白名单里，则设置 exit code = 1。
 * - 只影响脚本的退出码，不会修改任何产物。
 */
function isStrictMode(argv: string[]): boolean {
  return argv.includes('--strict');
}

/**
 * 脚本入口：
 * 1) 读取 `src/adapters/*` 里的映射文件（均由 `sync-src-assets.ts` 生成）
 * 2) 统计 Farm Token 总量与 antd 侧使用量
 * 3) 输出“未覆盖列表”，并在严格模式下对“非预期未覆盖”设置失败退出码
 */
async function main() {
  const [farmTokenMapRaw, antdTokenMapRaw, antdComponentsMapRaw] = await Promise.all([
    fs.readFile(farmTokenMapPath, 'utf8'),
    fs.readFile(antdTokenMapPath, 'utf8'),
    fs.readFile(antdComponentsMapPath, 'utf8')
  ]);

  const farmTokenMap = JSON.parse(farmTokenMapRaw) as StringMap;
  const antdTokenMap = JSON.parse(antdTokenMapRaw) as StringMap;
  const antdComponentsMap = JSON.parse(antdComponentsMapRaw) as ComponentsMap;

  const farmTokens = Object.keys(farmTokenMap).sort();
  const usage = collectUsage(antdTokenMap, antdComponentsMap);
  const unused = farmTokens.filter((token) => !usage.has(token));

  console.log(`[theme] Farm Token 总数：${farmTokens.length}`);
  console.log(`[theme] antd 覆盖到的 Farm Token：${usage.size}`);

  if (unused.length === 0) {
    console.log('[theme] 所有 Farm Token 都已映射到 antd（global/components）。');
    return;
  }

  console.log(`[theme] 以下 Farm Token 未映射到 antd（依然会出现在 tokens/cssVars/tailwind 中，供业务组件使用）：`);
  for (const token of unused) {
    const reason = expectedUnusedFarmTokens[token];
    console.log(reason ? `- ${token}（${reason}）` : `- ${token}`);
  }

  if (isStrictMode(process.argv.slice(2))) {
    const unexpected = unused.filter((token) => !(token in expectedUnusedFarmTokens));
    if (unexpected.length > 0) process.exitCode = 1;
  }
}

await main();
