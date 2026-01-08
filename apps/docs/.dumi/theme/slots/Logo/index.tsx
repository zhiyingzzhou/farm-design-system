import { Link, useLocale, useSiteData } from 'dumi';
import React from 'react';
import './index.less';

function DefaultMark() {
  return (
    <span className="farm-docs-logo__mark" aria-hidden="true">
      <span className="farm-docs-logo__mark-inner" />
    </span>
  );
}

/**
 * 文档站 Logo：
 * - 兼容 dumi 的 `themeConfig.name/logo`
 * - 默认提供一个极简 mark（避免每次换仓库都必须准备图片资源）
 *
 * 说明：
 * - 这里不做“版本号”等信息展示，避免 header 变成强耦合区域；
 * - 如需扩展（例如加 GitHub / 版本），建议优先用 `HeaderExtra` slot。
 */
export default function Logo() {
  const { themeConfig } = useSiteData();
  const locale = useLocale();

  const homePath = 'base' in locale ? locale.base : '/';
  const name = themeConfig.name || 'Farm Design System';
  const logo = themeConfig.logo;

  return (
    <Link className="farm-docs-logo" to={homePath} aria-label={`${name} 首页`}>
      {logo && logo !== false ? <img className="farm-docs-logo__img" src={logo} alt={name} /> : <DefaultMark />}
      <span className="farm-docs-logo__text">{name}</span>
    </Link>
  );
}

