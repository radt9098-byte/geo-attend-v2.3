package com.geoattend.app;
import android.Manifest;
import android.app.PendingIntent;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.Build;
import com.google.android.gms.location.*;
import org.json.JSONObject;
/** Approach alerts only wake precise verification; they never mark attendance. */
public final class ProximityFence {
 public static final String ACTION="com.geoattend.app.APPROACH";
 private static PendingIntent intent(Context c){return PendingIntent.getForegroundService(c,75,new Intent(c,AttendanceService.class).setAction(ACTION),PendingIntent.FLAG_UPDATE_CURRENT|(Build.VERSION.SDK_INT>=31?PendingIntent.FLAG_MUTABLE:0));}
 public static void register(Context c,Runnable ready,Runnable fallback){
  if(Build.VERSION.SDK_INT>=29&&c.checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION)!=PackageManager.PERMISSION_GRANTED){fallback.run();return;}
  try{JSONObject office=new JSONObject(new SessionStore(c).readPrivate("cachedStatus")).getJSONObject("office");Geofence fence=new Geofence.Builder().setRequestId("office-approach").setCircularRegion(office.getDouble("lat"),office.getDouble("lon"),100).setExpirationDuration(Geofence.NEVER_EXPIRE).setNotificationResponsiveness(90000).setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER|Geofence.GEOFENCE_TRANSITION_EXIT).build();GeofencingRequest request=new GeofencingRequest.Builder().setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_ENTER).addGeofence(fence).build();LocationServices.getGeofencingClient(c).addGeofences(request,intent(c)).addOnSuccessListener(v->ready.run()).addOnFailureListener(e->fallback.run());}catch(Exception e){fallback.run();}
 }
 public static void remove(Context c){try{LocationServices.getGeofencingClient(c).removeGeofences(intent(c));}catch(Exception ignored){}}
 public static boolean entering(Intent i){try{GeofencingEvent e=GeofencingEvent.fromIntent(i);return e!=null&&!e.hasError()&&e.getGeofenceTransition()==Geofence.GEOFENCE_TRANSITION_ENTER;}catch(Exception e){return false;}}
}
