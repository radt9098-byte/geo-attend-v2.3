package com.geoattend.app;
import java.util.Locale;
/** Display state only; attendance decisions remain in the tracking service/server. */
public final class UiStatus {
 public static String label(boolean running,boolean offline,boolean working,long age,String status){
  if(offline)return "Server unavailable · saved attendance";
  if(!running)return "Tracking paused";
  String s=status.toLowerCase(Locale.ROOT);
  if(s.contains("not scheduled"))return "Not scheduled today";
  if(age>180000)return "Waiting for fresh GPS";
  if(s.contains("retrying"))return "Connection retrying · saved on phone";
  if(s.contains("attention"))return "Sync needs attention";
  if(s.contains("mock")||s.contains("rejected"))return "Location rejected";
  if(s.contains("disabled")||s.contains("turn on")||s.contains("permission")||s.contains("cannot"))return "Location unavailable";
  if(s.contains("uncertain"))return "GPS uncertain";
  if(s.contains("waiting")||s.contains("finding"))return "Waiting for accurate GPS";
  if(s.contains("interrupted"))return "Connection interrupted";
  if(s.contains("confirming exit"))return "Confirming exit";
  if(s.equals("checked out")||s.equals("outside workplace"))return "Checked out";
  return working||s.equals("checked in")?"Checked in":"Checked out";
 }
 public static int tone(String label){if(label.equals("Checked in"))return 0;if(label.equals("Checked out")||label.equals("Tracking paused"))return 2;return 1;}
}
