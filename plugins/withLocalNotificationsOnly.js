const { withEntitlementsPlist } = require('expo/config-plugins');

/**
 * ローカル通知のみ使用するため、expo-notifications が付与する
 * aps-environment（リモートプッシュ用）を削除する。
 * Push Notifications capability 未設定のプロビジョニングプロファイルでもビルド可能にする。
 */
const withLocalNotificationsOnly = (config) => {
  return withEntitlementsPlist(config, (config) => {
    delete config.modResults['aps-environment'];
    return config;
  });
};

module.exports = withLocalNotificationsOnly;
