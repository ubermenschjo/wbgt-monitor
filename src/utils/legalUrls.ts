import Constants from 'expo-constants';

type Flavor = 'biz' | 'consumer';

/** Apple 標準 EULA（カスタム利用規約未設定時）。 */
export const APPLE_STANDARD_EULA_URL =
  'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

export const LEGAL_URLS: Record<
  Flavor,
  { privacyPolicyUrl: string; termsOfUseUrl: string }
> = {
  biz: {
    privacyPolicyUrl: 'https://stage-n.github.io/prj/wbgt-recorder/privacy.html',
    termsOfUseUrl: APPLE_STANDARD_EULA_URL,
  },
  consumer: {
    privacyPolicyUrl: 'https://stage-n.github.io/prj/wbgt-alert/privacy.html',
    termsOfUseUrl: APPLE_STANDARD_EULA_URL,
  },
};

function getFlavor(): Flavor {
  const fromExtra = Constants.expoConfig?.extra?.appFlavor as Flavor | undefined;
  const fromEnv = process.env.APP_FLAVOR as Flavor | undefined;
  return fromExtra ?? fromEnv ?? 'biz';
}

export function getLegalUrls() {
  return LEGAL_URLS[getFlavor()];
}
