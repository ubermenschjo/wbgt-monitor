/**
 * consumer → biz Pro への転換バナー。
 */

import { getFlavor } from '../hooks/useLabel';
import StagenAppBanner from './StagenAppBanner';

export type BizUpgradeVariant = 'settings' | 'soft' | 'share';

const COPY: Record<BizUpgradeVariant, { title: string; subtitle: string }> = {
  settings: {
    title: '業務で記録・CSV出力するなら 熱中症レコーダー Pro',
    subtitle: 'CSV出力・現場管理',
  },
  soft: {
    title: '現場の記録管理はProへ',
    subtitle: '業務用記録はProへ',
  },
  share: {
    title: 'チームで使うならPro',
    subtitle: 'CSV出力・現場管理',
  },
};

type Props = {
  variant?: BizUpgradeVariant;
};

export default function BizUpgradeBanner({ variant = 'settings' }: Props) {
  if (getFlavor() !== 'consumer') return null;

  const { title, subtitle } = COPY[variant];
  return (
    <StagenAppBanner
      targetApp="wbgt-biz"
      title={title}
      subtitle={subtitle}
      variant={variant === 'soft' ? 'soft' : 'settings'}
    />
  );
}
