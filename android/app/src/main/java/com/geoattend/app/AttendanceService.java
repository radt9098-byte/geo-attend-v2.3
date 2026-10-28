package com.geoattend.app;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.*;
import android.os.*;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import org.json.JSONObject;
import java.util.concurrent.*;

/** Live verification never waits for historical offline uploads. */
public final class AttendanceService extends Service implements LocationListener {
 public static volatile boolean running=false;
 public static final String CHANGED="com.geoattend.app.TRACKING_CHANGED",PAUSE="com.geoattend.app.PAUSE";
 private static final int ID=41;
 private final Handler handler=new Handler(Looper.getMainLooper());
 private final TrackingWork work=new TrackingWork();
 private LocationManager manager;private FusedLocationProviderClient fused;private volatile Location latest;
 private SessionStore store;private boolean sending=false,syncing=false,mockRejected=false;private volatile boolean stopping=false;
 private boolean started=false,nearOffice=true,fenceReady=false,scheduleOff=false;private String lastZone="";private long lastSent=0,lastSync=0,lastProviderRequest=0;
 private final LocationCallback fusedCallback=new LocationCallback(){@Override public void onLocationResult(LocationResult result){for(Location l:result.getLocations())onLocationChanged(l);}};
 private boolean fine(){return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED;}
 private boolean locationEnabled(){try{return manager.isProviderEnabled(LocationManager.GPS_PROVIDER)||manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER);}catch(Exception e){return false;}}
 private boolean restricted(){return Build.VERSION.SDK_INT>=28&&getSystemService(ActivityManager.class).isBackgroundRestricted();}
 private final Runnable tick=new Runnable(){public void run(){if(stopping)return;new OfflineAttendance(AttendanceService.this).expire();boolean allowed=WorkCalendar.today(AttendanceService.this);if(!allowed){if(!scheduleOff){scheduleOff=true;ProximityFence.remove(AttendanceService.this);fenceReady=false;stopProviders();latest=null;new OfflineAttendance(AttendanceService.this).finish();state("Not scheduled today · tracking off",0,0);}sendLocation();}else{if(scheduleOff){scheduleOff=false;registerFence();requestProviders();}if(fine()&&locationEnabled()&&(latest==null||fixAge(latest)>180000)&&SystemClock.elapsedRealtime()-lastProviderRequest>=180000)requestProviders();sendLocation();}syncHistory(store.token());handler.postDelayed(this,30000);}};
 private void stopProviders(){try{manager.removeUpdates(this);if(fused!=null)fused.removeLocationUpdates(fusedCallback);}catch(Exception ignored){}}
 @Override public void onCreate(){super.onCreate();running=true;store=new SessionStore(this);NotificationChannel channel=new NotificationChannel("attendance","Live attendance tracking",NotificationManager.IMPORTANCE_LOW);channel.setSound(null,null);channel.enableVibration(false);getSystemService(NotificationManager.class).createNotificationChannel(channel);manager=getSystemService(LocationManager.class);}
 @Override public int onStartCommand(Intent intent,int flags,int startId){
  if(intent!=null&&ProximityFence.ACTION.equals(intent.getAction())&&started&&store!=null){if(ProximityFence.entering(intent)){nearOffice=true;requestProviders();}return START_STICKY;}
  if(intent!=null&&PAUSE.equals(intent.getAction())){
   new OfflineAttendance(this).finish();store.prefs().edit().putBoolean("trackingWanted",false).apply();stopping=true;state("Tracking paused",0,0);
   work.live(()->{try{Api.call(this,"pause",new JSONObject());}catch(Exception ignored){}});
   work.history(()->{try{new OfflineAttendance(this).sync();}catch(Exception ignored){}});stopSelf();return START_NOT_STICKY;
  }
  if(store.token().isEmpty()||(intent!=null&&ProximityFence.ACTION.equals(intent.getAction())&&!store.prefs().getBoolean("trackingWanted",false))){stopSelf();return START_NOT_STICKY;}
  try{
   JSONObject server=new JSONObject(store.readPrivate("cachedStatus"));if(!server.has("schedule")){state("Run the v3.5 office server update, then reopen the app",0,0);stopSelf();return START_NOT_STICKY;}
   if(Build.VERSION.SDK_INT>=29)startForeground(ID,notification("Finding your location"),ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);else startForeground(ID,notification("Finding your location"));
   if(!fine()){state("Precise location permission needed",0,0);store.prefs().edit().putBoolean("trackingWanted",false).apply();stopSelf();return START_NOT_STICKY;}
   started=true;store.prefs().edit().putBoolean("trackingWanted",true).putBoolean("serviceRunning",true).apply();
   if(WorkCalendar.today(this)){registerFence();requestProviders();}state(locationEnabled()?"Finding your location":"GPS off — turn on device location",0,0);handler.removeCallbacks(tick);handler.post(tick);
  }catch(Exception e){state("Cannot start tracking. Open Controls and check permissions.",0,0);store.prefs().edit().putBoolean("trackingWanted",false).apply();stopSelf();}
  return START_STICKY;
 }
 private void registerFence(){ProximityFence.register(this,()->{if(stopping||!WorkCalendar.today(this)){ProximityFence.remove(this);return;}fenceReady=true;},()->fenceReady=false);}
 private void nativeFallback(){if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED)return;if(stopping||!WorkCalendar.today(this))return;try{manager.removeUpdates(this);manager.requestLocationUpdates(LocationManager.GPS_PROVIDER,90000,0,this,Looper.getMainLooper());}catch(Exception e){state("Location provider unavailable",0,0);}}
 private void requestProviders(){
  if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED)return;
  if(!WorkCalendar.today(this))return;lastProviderRequest=SystemClock.elapsedRealtime();stopProviders();
  try{if(fused==null)fused=LocationServices.getFusedLocationProviderClient(this);
   com.google.android.gms.location.LocationRequest request=new com.google.android.gms.location.LocationRequest.Builder(fenceReady&&!nearOffice?Priority.PRIORITY_BALANCED_POWER_ACCURACY:Priority.PRIORITY_HIGH_ACCURACY,90000).setMinUpdateIntervalMillis(90000).setMaxUpdateDelayMillis(90000).setWaitForAccurateLocation(true).build();
   fused.requestLocationUpdates(request,fusedCallback,Looper.getMainLooper()).addOnFailureListener(e->nativeFallback());
  }catch(Exception e){nativeFallback();}
 }
 private static long fixAge(Location l){return (SystemClock.elapsedRealtimeNanos()-l.getElapsedRealtimeNanos())/1000000;}
 @Override public void onLocationChanged(Location location){
  if(stopping||!WorkCalendar.today(this))return;boolean mock=Build.VERSION.SDK_INT>=31?location.isMock():location.isFromMockProvider();
  if(mock){latest=null;mockRejected=true;state("Mock location rejected",0,0);sendLocation();return;}
  if(!location.hasAccuracy()||location.getAccuracy()<=0||fixAge(location)<0||fixAge(location)>30000)return;
  if(latest!=null&&location.getElapsedRealtimeNanos()<=latest.getElapsedRealtimeNanos())return;
  mockRejected=false;
  if(fenceReady)try{JSONObject office=new JSONObject(store.readPrivate("cachedStatus")).getJSONObject("office");double distance=OfflineAttendance.distance(office.getDouble("lat"),office.getDouble("lon"),location.getLatitude(),location.getLongitude());boolean near=distance-location.getAccuracy()<=150;if(near!=nearOffice){nearOffice=near;requestProviders();}}catch(Exception ignored){}
  if(latest==null||fixAge(latest)>15000||location.getAccuracy()<=latest.getAccuracy()*1.5f){latest=new Location(location);try{String zone=new OfflineAttendance(this).capture(location.getLatitude(),location.getLongitude(),location.getAccuracy(),location.getElapsedRealtimeNanos()/1000000);if(!zone.equals(lastZone)||"confirming exit".equals(store.prefs().getString("trackingStatus",""))){lastZone=zone;lastSent=0;}}catch(Exception e){store.prefs().edit().putString("syncIssue","Could not save location evidence: "+e.getMessage()).apply();}store.prefs().edit().putLong("fixAt",System.currentTimeMillis()-fixAge(location)).apply();}
  sendLocation();
 }
 private JSONObject healthBody(String state)throws Exception {Location l=latest;return Api.body("state",state,"fixAge",l==null?JSONObject.NULL:Math.min(86400000,Math.max(0,fixAge(l))),"pending",Math.min(2000,new OfflineAttendance(this).pendingCount()),"batteryRestricted",restricted());}
 private String unavailable(){if(scheduleOff)return "scheduled_off";if(!fine())return "permission_denied";if(!locationEnabled())return "gps_off";if(mockRejected)return "mock_rejected";return latest==null?"finding":"stale_fix";}
 private String healthLabel(String state){switch(state){case "scheduled_off":return "Not scheduled today · tracking off";case "permission_denied":return "Precise location permission needed";case "gps_off":return "GPS off — turn on device location";case "mock_rejected":return "Mock location rejected";case "stale_fix":return "Waiting for fresh GPS";default:return "Finding an accurate location";}}
 private void sendLocation(){
  if(stopping||sending||lastSent!=0&&SystemClock.elapsedRealtime()-lastSent<120000)return;
  final String session=store.token();if(session.isEmpty()){stopSelf();return;}
  final Location candidate=latest;final boolean usable=!scheduleOff&&fine()&&locationEnabled()&&candidate!=null&&fixAge(candidate)>=0&&fixAge(candidate)<=120000;
  final Location location=usable?new Location(candidate):null;final String missing=usable?"":unavailable();
  if(!usable)state(healthLabel(missing),0,0);
  sending=true;lastSent=SystemClock.elapsedRealtime();
  work.live(()->{
   try{
    if(stopping||!session.equals(store.token()))return;
    if(location==null){Api.call(this,"health",healthBody(missing));store.prefs().edit().putLong("lastContactAt",System.currentTimeMillis()).putBoolean("connectionRetrying",false).apply();handler.post(()->syncHistory(session));return;}
    long age=fixAge(location);if(age<0||age>120000){handler.post(()->{if(!stopping)state("Waiting for fresh GPS",0,0);});return;}
    JSONObject body=Api.body("lat",location.getLatitude(),"lon",location.getLongitude(),"accuracy",location.getAccuracy(),"age",age,"pending",Math.min(2000,new OfflineAttendance(this).pendingCount()),"batteryRestricted",restricted());
    JSONObject r=Api.call(this,"heartbeat",body);
    WorkCalendar.save(this,r.optJSONArray("schedule"));if("checked in".equals(r.optString("state")))new OfflineAttendance(this).confirmLive(r.optLong("sessionStart"),r.optLong("verifiedAt"));
    if(!stopping&&session.equals(store.token()))handler.post(()->{if(stopping)return;store.prefs().edit().putLong("lastContactAt",System.currentTimeMillis()).putBoolean("connectionRetrying",false).apply();state(r.optString("state","Connected"),r.optInt("distance"),r.optInt("accuracy"));syncHistory(session);});
   }catch(Exception e){handler.post(()->{
    if(stopping||!session.equals(store.token()))return;
    if(e instanceof Api.Failure&&((Api.Failure)e).code==401){store.clear();state("Session expired. Please log in again.",0,0);stopSelf();}
    else if(e instanceof Api.Failure&&((Api.Failure)e).code<500){state("Location update needs attention: "+e.getMessage(),0,0);}
    else if(location!=null)try{store.prefs().edit().putBoolean("connectionRetrying",true).apply();state("Connection retrying · location saved on phone",store.prefs().getInt("distance",0),store.prefs().getInt("accuracy",0));}catch(Exception save){state("Cannot save offline attendance: "+save.getMessage(),0,0);}
    else state(healthLabel(missing)+" · server connection unavailable",0,0);
   });}finally{handler.post(()->sending=false);}
  });
 }
 private void syncHistory(String session){
  if(stopping||syncing||SystemClock.elapsedRealtime()-lastSync<120000)return;syncing=true;lastSync=SystemClock.elapsedRealtime();
  work.history(()->{try{
   if(!session.equals(store.token()))return;
   JSONObject status=Api.call(this,"status",null);if(status.isNull("user"))throw new Api.Failure(401,"Please log in again.");
   if(!session.equals(store.token()))return;store.savePrivate("cachedStatus",status.toString());WorkCalendar.save(this,status.optJSONArray("schedule"));
   OfflineAttendance history=new OfflineAttendance(this);history.connected();history.sync();store.prefs().edit().remove("syncIssue").apply();
  }catch(Exception e){
   if(session.equals(store.token())){
    store.prefs().edit().putString("syncIssue",e instanceof Api.Failure&&((Api.Failure)e).code<500?"Saved records need review: "+e.getMessage():"Saved records await a successful connection.").apply();
    if(e instanceof Api.Failure&&((Api.Failure)e).code==401)handler.post(()->{if(!stopping&&session.equals(store.token())){store.clear();state("Session expired. Please log in again.",0,0);stopSelf();}});
    else if(e instanceof Api.Failure&&((Api.Failure)e).code<500)try{Api.call(this,"health",healthBody("sync_attention"));}catch(Exception ignored){}
   }
  }finally{handler.post(()->{syncing=false;if(!stopping)sendBroadcast(new Intent(CHANGED).setPackage(getPackageName()));});}});
 }
 private Notification notification(String text){Intent open=new Intent(this,MainActivity.class);PendingIntent activity=PendingIntent.getActivity(this,0,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);PendingIntent pause=PendingIntent.getService(this,1,new Intent(this,AttendanceService.class).setAction(PAUSE),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);return new Notification.Builder(this,"attendance").setSmallIcon(R.drawable.ic_location).setContentTitle("Geo Attend · live attendance").setContentText(text).setContentIntent(activity).setOngoing(true).setOnlyAlertOnce(true).setCategory(Notification.CATEGORY_SERVICE).addAction(new Notification.Action.Builder(null,"Pause tracking",pause).build()).build();}
 private void state(String text,int distance,int accuracy){store.prefs().edit().putString("trackingStatus",text).putLong("statusAt",System.currentTimeMillis()).putInt("distance",distance).putInt("accuracy",accuracy).apply();if(!stopping)getSystemService(NotificationManager.class).notify(ID,notification(text));sendBroadcast(new Intent(CHANGED).setPackage(getPackageName()));}
 @Override public void onProviderDisabled(String p){if(!locationEnabled()){latest=null;state("GPS off — turn on device location",0,0);}sendLocation();}
 @Override public void onProviderEnabled(String p){if(stopping)return;if(fine()&&WorkCalendar.today(this))requestProviders();state("Finding your location",0,0);sendLocation();}
 @Override public void onStatusChanged(String p,int status,Bundle extras){}
 @Override public IBinder onBind(Intent i){return null;}
 @Override public void onDestroy(){stopping=true;running=false;ProximityFence.remove(this);handler.removeCallbacksAndMessages(null);try{if(manager!=null)manager.removeUpdates(this);if(fused!=null)fused.removeLocationUpdates(fusedCallback);}catch(Exception ignored){}if(store!=null){store.prefs().edit().putBoolean("serviceRunning",false).apply();sendBroadcast(new Intent(CHANGED).setPackage(getPackageName()));}work.close();stopForeground(STOP_FOREGROUND_REMOVE);super.onDestroy();}
}
