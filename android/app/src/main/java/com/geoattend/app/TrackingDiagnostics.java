package com.geoattend.app;
import android.Manifest;
import android.app.ActivityManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import org.json.JSONObject;
/** Report a stopped tracker only while the employee actually has the app open. */
public final class TrackingDiagnostics {
 public static void reportInactive(Context source){Context c=source.getApplicationContext();if(AttendanceService.running)return;SessionStore store=new SessionStore(c);String session=store.token();if(session.isEmpty())return;
  try{if(!"employee".equals(new JSONObject(store.prefs().getString("user","{}")).optString("role")))return;}catch(Exception ignored){return;}
  String state=c.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED?"permission_denied":store.prefs().getBoolean("trackingWanted",false)?"service_error":"paused";
  boolean restricted=Build.VERSION.SDK_INT>=28&&c.getSystemService(ActivityManager.class).isBackgroundRestricted();
  new Thread(()->{try{if(AttendanceService.running||!session.equals(store.token()))return;Api.call(c,"health",Api.body("state",state,"fixAge",JSONObject.NULL,"pending",Math.min(2000,new OfflineAttendance(c).pendingCount()),"batteryRestricted",restricted));}catch(Exception ignored){}},"attendance-health").start();
 }
}
