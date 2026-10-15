package com.geoattend.app;

import android.app.*;
import android.content.*;
import android.os.Build;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import org.json.JSONObject;
import java.text.DateFormat;
import java.util.*;

/** Private, silent attendance alerts. No public topics or employee subscriptions. */
public final class PushMessaging extends FirebaseMessagingService {
 public static final String CHANNEL="admin_attendance_silent_v1";
 public static void channel(Context c){
  NotificationChannel n=new NotificationChannel(CHANNEL,"Attendance updates",NotificationManager.IMPORTANCE_LOW);
  n.setDescription("Silent employee check-in and check-out updates");n.setSound(null,null);n.enableVibration(false);n.setShowBadge(true);n.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
  c.getSystemService(NotificationManager.class).createNotificationChannel(n);
 }
 public static void refresh(Context context){
  Context c=context.getApplicationContext();channel(c);
  SessionStore s=new SessionStore(c);if(s.token().isEmpty())return;
  try{if(!"admin".equals(new JSONObject(s.prefs().getString("user","{}")).optString("role")))return;}catch(Exception e){return;}
  FirebaseMessaging.getInstance().getToken().addOnSuccessListener(t->new Thread(()->{
   try{JSONObject status=Api.call(c,"status",null);JSONObject user=status.optJSONObject("user");
    if(user==null||!"admin".equals(user.optString("role"))||!status.optBoolean("pushEnabled"))return;
    Api.call(c,"registerPush",Api.body("token",t));s.prefs().edit().putString("pushRegistrationStatus","Connected").apply();
   }catch(Exception ignored){s.prefs().edit().putString("pushRegistrationStatus","Connection pending. Reopen Notifications to retry.").apply();}
  },"attendance-push-register").start());
 }
 @Override public void onNewToken(String token){refresh(this);}
 @Override public void onMessageReceived(RemoteMessage message){
  SessionStore s=new SessionStore(this);if(s.token().isEmpty())return;
  try{
   JSONObject user=new JSONObject(s.prefs().getString("user","{}"));Map<String,String>d=message.getData();
   String event=d.get("eventId"),kind=d.get("kind"),employee=d.get("employeeId"),recipient=d.get("adminId");
   if(!"admin".equals(user.optString("role"))||!user.optString("id").equals(recipient)||event==null||!event.matches("[a-f0-9-]{36}:(in|out)")||employee==null)return;
   StringBuilder sessionHash=new StringBuilder();for(byte value:java.security.MessageDigest.getInstance("SHA-256").digest(s.token().getBytes(java.nio.charset.StandardCharsets.UTF_8)))sessionHash.append(String.format(java.util.Locale.ROOT,"%02x",value&255));if(!sessionHash.toString().equals(d.get("sessionId")))return;
   if(!"in".equals(kind)&&!"out".equals(kind))return;
   long at=Long.parseLong(d.get("at"));if(at<=0||at>System.currentTimeMillis()+300000)return;
   String dedup="push_seen_"+event;if(s.prefs().contains(dedup))return;
   channel(this);String reason=d.get("reason"),title="in".equals(kind)?"Employee checked in":"Employee checked out";
   boolean test="notification test".equals(reason);
   if(test)title="Geo Attend · Silent notification test";
   else if("out".equals(kind)&&!"left workplace".equals(reason))title="Attendance ended";
   String name=d.get("name");if(name==null||name.length()>100)name="Employee";
   String body=name+" · "+DateFormat.getDateTimeInstance(DateFormat.SHORT,DateFormat.SHORT).format(new Date(at));
   if(test)body="Silent notifications are working on this phone.";else if("out".equals(kind)&&reason!=null&&!reason.isEmpty())body+=" · "+reason;
   if(!test&&System.currentTimeMillis()-at>300000)body+=" · delayed update";
   Intent open=new Intent(this,MainActivity.class).putExtra("attendanceEmployee",test?"":employee).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
   PendingIntent pending=PendingIntent.getActivity(this,event.hashCode(),open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
   Notification n=new Notification.Builder(this,CHANNEL).setSmallIcon(R.drawable.ic_location).setContentTitle(title).setContentText(body).setStyle(new Notification.BigTextStyle().bigText(body)).setContentIntent(pending).setAutoCancel(true).setOnlyAlertOnce(true).setSound(null).setVibrate(new long[0]).setDefaults(0).setVisibility(Notification.VISIBILITY_PRIVATE).setWhen(at).build();
   getSystemService(NotificationManager.class).notify(event,0,n);
   android.content.SharedPreferences.Editor edit=s.prefs().edit();long now=System.currentTimeMillis();for(Map.Entry<String,?> entry:s.prefs().getAll().entrySet())if(entry.getKey().startsWith("push_seen_")&&entry.getValue() instanceof Long&&now-(Long)entry.getValue()>172800000)edit.remove(entry.getKey());edit.putLong(dedup,now).apply();
  }catch(Exception ignored){/* Malformed or permission-blocked push never changes attendance. */}
 }
}
