import WidgetKit
import SwiftUI

struct WbgtEntry: TimelineEntry {
  let date: Date
  let snapshot: WidgetSnapshotData?
}

struct WbgtProvider: TimelineProvider {
  func placeholder(in context: Context) -> WbgtEntry {
    WbgtEntry(date: Date(), snapshot: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (WbgtEntry) -> Void) {
    completion(WbgtEntry(date: Date(), snapshot: loadWidgetSnapshot()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<WbgtEntry>) -> Void) {
    let entry = WbgtEntry(date: Date(), snapshot: loadWidgetSnapshot())
    let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
    completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
  }
}

struct WbgtAlertWidgetEntryView: View {
  var entry: WbgtProvider.Entry

  var body: some View {
    if let snapshot = entry.snapshot {
      VStack(alignment: .leading, spacing: 6) {
        Text("WBGT")
          .font(.caption)
          .foregroundColor(.secondary)
        Text(String(format: "%.1f℃", snapshot.wbgt))
          .font(.title)
          .fontWeight(.bold)
          .foregroundColor(Color(hex: snapshot.riskColor))
        Text(snapshot.riskLabel)
          .font(.subheadline)
          .fontWeight(.semibold)
        if snapshot.isRecording {
          Text("記録中 \(formatElapsed(snapshot.elapsedSec))")
            .font(.caption2)
            .foregroundColor(.secondary)
        } else if let place = snapshot.placeName, !place.isEmpty {
          Text(place)
            .font(.caption2)
            .foregroundColor(.secondary)
            .lineLimit(1)
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
      .padding(12)
    } else {
      VStack(alignment: .leading, spacing: 4) {
        Text("熱中症アラート")
          .font(.caption)
          .foregroundColor(.secondary)
        Text("—")
          .font(.title2)
          .fontWeight(.bold)
        Text("アプリを開いて更新")
          .font(.caption2)
          .foregroundColor(.secondary)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
      .padding(12)
    }
  }
}

extension Color {
  init(hex: String) {
    let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
    var int: UInt64 = 0
    Scanner(string: hex).scanHexInt64(&int)
    let r = Double((int >> 16) & 0xff) / 255
    let g = Double((int >> 8) & 0xff) / 255
    let b = Double(int & 0xff) / 255
    self.init(red: r, green: g, blue: b)
  }
}

struct WbgtAlertWidget: Widget {
  let kind = "WbgtAlertWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: WbgtProvider()) { entry in
      WbgtAlertWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("WBGT")
    .description("現在の暑さ指数とリスクレベル")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
