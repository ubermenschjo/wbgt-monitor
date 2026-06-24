import Foundation

struct WidgetSnapshotData: Codable {
  let updatedAt: String
  let wbgt: Double
  let riskLevel: Int
  let riskColor: String
  let riskLabel: String
  let placeName: String?
  let isRecording: Bool
  let elapsedSec: Int
}

func loadWidgetSnapshot() -> WidgetSnapshotData? {
  let suiteName = "group.com.stagen.wbgt.consumer.expowidgets"
  let dataKey = "wbgt_widget_snapshot"
  guard let jsonData = UserDefaults(suiteName: suiteName)?.string(forKey: dataKey),
        let data = jsonData.data(using: .utf8) else {
    return nil
  }
  return try? JSONDecoder().decode(WidgetSnapshotData.self, from: data)
}

func formatElapsed(_ seconds: Int) -> String {
  let m = seconds / 60
  let s = seconds % 60
  return String(format: "%d:%02d", m, s)
}
