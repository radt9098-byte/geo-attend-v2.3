package com.geoattend.app;
import android.content.Context;
import org.json.*;
import java.text.SimpleDateFormat;
import java.util.*;
/** Cached office schedule; a missing override uses the Sunday holiday rule. */
public final class WorkCalendar {
 public static String day(long at){SimpleDateFormat f=new SimpleDateFormat("yyyy-MM-dd",Locale.ROOT);f.setTimeZone(TimeZone.getTimeZone("Asia/Kolkata"));return f.format(new Date(at));}
 public static JSONArray rows(Context c){try{String raw=new SessionStore(c).readPrivate("workCalendar");return raw.isEmpty()?new JSONArray():new JSONArray(raw);}catch(Exception e){return new JSONArray();}}
 public static void save(Context c,JSONArray rows) throws Exception {if(rows!=null)new SessionStore(c).savePrivate("workCalendar",rows.toString());}
 public static JSONObject override(Context c,String day){JSONArray rows=rows(c);for(int i=0;i<rows.length();i++){JSONObject r=rows.optJSONObject(i);if(r!=null&&day.equals(r.optString("day")))return r;}return null;}
 public static boolean allowed(Context c,String day,String account){try{JSONObject row=override(c,day);if(row!=null){String mode=row.optString("mode");if(mode.equals("all"))return true;if(mode.equals("holiday"))return false;JSONArray ids=new JSONArray(row.optString("employees","[]"));for(int i=0;i<ids.length();i++)if(account.equals(ids.optString(i)))return true;return false;}return java.time.LocalDate.parse(day).getDayOfWeek()!=java.time.DayOfWeek.SUNDAY;}catch(Exception e){return false;}}
 public static boolean today(Context c){try{JSONObject cached=new JSONObject(new SessionStore(c).readPrivate("cachedStatus"));String id=cached.getJSONObject("user").getString("id");return allowed(c,day(System.currentTimeMillis()),id);}catch(Exception e){return false;}}
 public static String label(Context c,String day,String account){JSONObject r=override(c,day);if(account.isEmpty()){if(r!=null){if(r.optString("mode").equals("selected"))return "Selected employees working";return r.optString("mode").equals("all")?"Working day":"Holiday";}return java.time.LocalDate.parse(day).getDayOfWeek()==java.time.DayOfWeek.SUNDAY?"Holiday":"Working day";}return allowed(c,day,account)?"Working day":"Not scheduled";}
}
