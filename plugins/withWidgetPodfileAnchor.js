const { withDangerousMod, withPodfile } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');
const plist = require('plist');

/** ponytail: SDK 54는 xcodeproj mod가 podfile mod보다 먼저라 expo-widgets anchor가 없음 */
const ANCHOR_BLOCK = `    installer.target_installation_results.pod_target_installation_results.each do |pod_name, target_installation_result|
      target_installation_result.resource_bundle_targets.each do |resource_bundle_target|
        resource_bundle_target.build_configurations.each do |config|
        end
      end
    end`;

const WIDGET_TARGET = `target 'WBGTWidgetExtension' do
  use_frameworks! :linkage => podfile_properties['ios.useFrameworks'].to_sym if podfile_properties['ios.useFrameworks']
  use_frameworks! :linkage => ENV['USE_FRAMEWORKS'].to_sym if ENV['USE_FRAMEWORKS']
end`;

function withWidgetPodfileAnchor(config) {
  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');
      if (!contents.includes('resource_bundle_target.build_configurations')) {
        contents = contents.replace(
          /post_install do \|installer\|\n/,
          `post_install do |installer|\n${ANCHOR_BLOCK}\n`,
        );
        fs.writeFileSync(podfile, contents);
      }
      return cfg;
    },
  ]);

  return withPodfile(config, (cfg) => {
    let contents = cfg.modResults.contents;
    contents = contents.replace(
      /target 'WBGTWidgetExtension' do[\s\S]*?^end/m,
      WIDGET_TARGET,
    );
    cfg.modResults.contents = contents;

    const entPath = path.join(
      cfg.modRequest.platformProjectRoot,
      'WBGTWidgetExtension/WBGTWidgetExtension.entitlements',
    );
    if (fs.existsSync(entPath)) {
      const data = plist.parse(fs.readFileSync(entPath, 'utf8'));
      delete data['aps-environment'];
      fs.writeFileSync(entPath, plist.build(data));
    }

    return cfg;
  });
}

module.exports = withWidgetPodfileAnchor;
