package com.geoattend.app;

import android.content.Context;
import android.os.SystemClock;
import org.json.*;
import java.io.IOException;
import java.util.UUID;

/** Encrypted, per-account pending intervals. Coordinates of fixes are never persisted. */
public final class OfflineAttendance {
 private static final Object LOCK=new Object();
 private final Context context;private final SessionStore store;
 public OfflineAttendance(Context c){context=c.getApplicationContext();store=new SessionStore(context);}
 private JSONObject load() throws JSONException {String raw=store.readPrivate("offlineAttendance");return raw.isEmpty()?new JSONObject().put("records",new JSONArray()):new JSONObject(raw);}
 private void save(JSONObject j) throws Exception {store.savePrivate("offlineAttendance",j.toString());}
 public JSONArray pendingRecords(){synchronized(LOCK){try{expire();JSONObject j=load();JSONArray list=new JSONArray(j.getJSONArray("records").toString());JSONObject open=j.optJSONObject("open");if(open!=null&&(store.prefs().getBoolean("connectionRetrying",false)||!AttendanceService.running))list.put(new JSONObject(open.toString()).put("end",open.optLong("last")));return list;}catch(Exception e){return new JSONArray();}}}
 public long todayMillis(){JSONArray list=pendingRecords();java.util.Calendar c=java.util.Calendar.getInstance();c.set(java.util.Calendar.HOUR_OF_DAY,0);c.set(java.util.Calendar.MINUTE,0);c.set(java.util.Calendar.SECOND,0);c.set(java.util.Calendar.MILLISECOND,0);long total=0;for(int i=0;i<list.length();i++){JSONObject r=list.optJSONObject(i);total+=Math.max(0,r.optLong("end")-Math.max(c.getTimeInMillis(),r.optLong("start")));}return total;}
 public int pendingCount(){synchronized(LOCK){try{JSONObject j=load();return j.getJSONArray("records").length()+(j.has("open")&&(store.prefs().getBoolean("connectionRetrying",false)||!AttendanceService.running)?1:0);}catch(Exception e){return 0;}}}
 private void finish(JSONObject j) throws JSONException {JSONObject open=j.optJSONObject("open");if(open!=null){open.put("end",open.getLong("last"));if(open.getLong("end")>open.getLong("start"))j.getJSONArray("records").put(open);j.remove("open");}j.remove("outsideAt");}
 public void finish(){synchronized(LOCK){try{JSONObject j=load();finish(j);save(j);}catch(Exception e){store.prefs().edit().putString("trackingStatus","Could not save offline attendance").apply();}}}
 public void expire(){synchronized(LOCK){try{JSONObject j=load();JSONObject open=j.optJSONObject("open");if(open!=null&&(SystemClock.elapsedRealtime()<open.optLong("elapsed")||SystemClock.elapsedRealtime()-open.optLong("elapsed")>360000)){finish(j);save(j);}}catch(Exception ignored){}}}
 public String capture(double lat,double lon,double accuracy,long fixElapsed) throws Exception {synchronized(LOCK){
  JSONObject cached=new JSONObject(store.readPrivate("cachedStatus")),user=cached.getJSONObject("user"),office=cached.getJSONObject("office");
  JSONObject j=load();String account=user.getString("id");if(j.has("account")&&!account.equals(j.getString("account")))throw new IOException("Previous employee has pending attendance. Sync it first.");j.put("account",account);
  long elapsed=fixElapsed,age=SystemClock.elapsedRealtime()-elapsed;if(age<0||age>60000)throw new IOException("Waiting for fresh GPS");long now=System.currentTimeMillis()+store.prefs().getLong("serverOffset",0)-age;JSONObject open=j.optJSONObject("open");
  if(open!=null&&(elapsed<open.optLong("elapsed")||elapsed-open.optLong("elapsed")>360000||Math.abs((now-open.optLong("last"))-(elapsed-open.optLong("elapsed")))>60000||!office.toString().equals(open.getJSONObject("office").toString())||now-open.optLong("start")>=43200000)){finish(j);open=null;}
  double d=distance(office.getDouble("lat"),office.getDouble("lon"),lat,lon);String state;
  if(d+accuracy<=office.getInt("radius")){
   if(open==null){if(j.getJSONArray("records").length()>=2000)throw new IOException("Offline storage full. Connect to sync.");open=new JSONObject().put("id",UUID.randomUUID().toString()).put("account",account).put("start",now).put("office",office).put("distance",d).put("accuracy",accuracy);j.put("open",open);}
   open.put("last",now).put("elapsed",elapsed);j.remove("outsideAt");state="Offline · checked in · pending sync";
  }else if(d-accuracy>office.getInt("radius")){
   if(open!=null){long outside=j.optLong("outsideAt",0);if(outside!=0&&elapsed-outside>=15000){finish(j);state="Offline · checked out · pending sync";}else{if(outside==0)j.put("outsideAt",elapsed);state="Offline · confirming exit";}}else state="Offline · outside workplace";
  }else{j.remove("outsideAt");state="Offline · GPS uncertain";}
  save(j);store.prefs().edit().putInt("distance",(int)Math.round(d)).putInt("accuracy",(int)Math.round(accuracy)).apply();return state;
 }}
 /** Remove only the currently buffered interval explicitly covered by this live session. */
 public void confirmLive(long sessionStart,long verifiedAt)throws Exception {synchronized(LOCK){JSONObject j=load();JSONObject o=j.optJSONObject("open");if(o!=null&&sessionStart>0&&o.optLong("start")>=sessionStart&&o.optLong("last")<=verifiedAt){j.remove("open");j.remove("outsideAt");save(j);}}}
 public void connected() throws Exception {synchronized(LOCK){JSONObject j=load();finish(j);save(j);}}
 /** Send stable IDs; only remove after explicit server acknowledgement. */
 public void sync() throws Exception {
  JSONArray batch=new JSONArray();String account;
  synchronized(LOCK){expire();JSONObject j=load();account=j.optString("account");JSONArray records=j.getJSONArray("records");for(int i=0;i<records.length()&&i<5;i++)batch.put(records.getJSONObject(i));}
  if(batch.length()==0)return;
  JSONObject reply=Api.call(context,"syncOffline",Api.body("records",batch));JSONArray acknowledged=reply.getJSONArray("accepted");
  synchronized(LOCK){JSONObject j=load();if(!account.equals(j.optString("account")))return;JSONArray old=j.getJSONArray("records"),keep=new JSONArray();for(int i=0;i<old.length();i++){JSONObject r=old.getJSONObject(i);boolean done=false;for(int k=0;k<acknowledged.length();k++)if(r.getString("id").equals(acknowledged.getString(k)))done=true;if(!done)keep.put(r);}j.put("records",keep);save(j);}
 }
 public static double distance(double a,double b,double c,double d){double x=Math.sin(Math.toRadians(c-a)/2),y=Math.sin(Math.toRadians(d-b)/2);double h=x*x+Math.cos(Math.toRadians(a))*Math.cos(Math.toRadians(c))*y*y;return 6371000*2*Math.atan2(Math.sqrt(Math.min(1,h)),Math.sqrt(Math.max(0,1-h)));}
}
