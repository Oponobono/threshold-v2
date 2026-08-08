package expo.modules.threshold_exactalarm

import android.app.AlarmManager
import android.content.Context
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ThresholdExactAlarmModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ThresholdExactAlarm")

    AsyncFunction("canScheduleExactAlarms") { ->
      val context = appContext.reactContext
        ?: return@AsyncFunction null
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return@AsyncFunction true
      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
        ?: return@AsyncFunction null
      alarmManager.canScheduleExactAlarms()
    }
  }
}
