import ExpoModulesCore
import WidgetKit

public class ExpoWidgetsModule: Module {
  private let suiteName = "group.com.stagen.wbgt.consumer.expowidgets"
  private let dataKey = "wbgt_widget_snapshot"

  public func definition() -> ModuleDefinition {
    Name("ExpoWidgets")

    Function("setWidgetData") { (data: String) -> Void in
      let widgetSuite = UserDefaults(suiteName: self.suiteName)
      widgetSuite?.set(data, forKey: self.dataKey)

      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }
    }
  }
}
