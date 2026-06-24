package com.stagen.wbgt.consumer

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.graphics.Color
import android.widget.RemoteViews
import org.json.JSONObject

class WbgtWidget : AppWidgetProvider() {
  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray,
  ) {
    for (appWidgetId in appWidgetIds) {
      updateAppWidget(context, appWidgetManager, appWidgetId)
    }
  }
}

internal fun updateAppWidget(
  context: Context,
  appWidgetManager: AppWidgetManager,
  appWidgetId: Int,
) {
  val views = RemoteViews(context.packageName, R.layout.wbgt_widget)
  try {
    val jsonData =
      context
        .getSharedPreferences("${context.packageName}.widgetdata", Context.MODE_PRIVATE)
        .getString("widgetdata", "{}") ?: "{}"
    val data = JSONObject(jsonData)
    val wbgt = data.optDouble("wbgt", Double.NaN)
    val riskLabel = data.optString("riskLabel", "")
    val riskColor = data.optString("riskColor", "#1395BA")
    val isRecording = data.optBoolean("isRecording", false)
    val elapsedSec = data.optInt("elapsedSec", 0)

    if (!wbgt.isNaN()) {
      views.setTextViewText(R.id.widget_wbgt, String.format("%.1f℃", wbgt))
      views.setTextColor(R.id.widget_wbgt, Color.parseColor(riskColor))
      views.setTextViewText(
        R.id.widget_subtitle,
        if (isRecording) {
          "記録中 ${elapsedSec / 60}:${String.format("%02d", elapsedSec % 60)}"
        } else {
          riskLabel
        },
      )
    }
  } catch (_: Exception) {
    views.setTextViewText(R.id.widget_subtitle, "アプリを開いて更新")
  }
  appWidgetManager.updateAppWidget(appWidgetId, views)
}
