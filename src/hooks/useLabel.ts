import Constants from 'expo-constants';

import bizLabels from '../../i18n/biz.json';
import consumerLabels from '../../i18n/consumer.json';

export type Flavor = 'biz' | 'consumer';

export interface Labels {
  appName: string;
  startButton: string;
  endButton: string;
  recordSection: string;
  workerCount: string | null;
  measureLabel: string;
  csvExport: boolean;
}

const labelMap: Record<Flavor, Labels> = {
  biz: bizLabels as Labels,
  consumer: consumerLabels as Labels,
};

export function getFlavor(): Flavor {
  const fromExtra = Constants.expoConfig?.extra?.appFlavor as Flavor | undefined;
  const fromEnv = process.env.APP_FLAVOR as Flavor | undefined;
  return fromExtra ?? fromEnv ?? 'biz';
}

export function useLabel(): Labels {
  return labelMap[getFlavor()];
}
