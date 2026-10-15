package com.geoattend.app;
/** Advisory connectivity is independent of verified attendance. */
public final class TrackingHealth {
 public static String label(String state,long contact,long verified,long now,boolean saved){
  if(saved)return "Saved status · awaiting connection";
  if(contact<=0)return verified>0&&now-verified<=90000?"Location connected":"No recent connection";
  if(now-contact>90000)return "No recent connection";
  return reported(state);
 }
 public static String reported(String state){switch(state){
  case "inside":case "outside":return "Location connected";
  case "uncertain":return "GPS uncertain";
  case "gps_off":return "GPS off";
  case "permission_denied":return "Precise location permission missing";
  case "stale_fix":return "Waiting for fresh GPS";
  case "finding":return "Finding an accurate location";
  case "mock_rejected":return "Mock location rejected";
  case "sync_attention":return "Online · saved records need review";
  case "paused":return "Tracking paused";
  case "stopped":return "Tracking stopped";
  case "service_error":return "Tracking service stopped";
  default:return "Phone connected";
 }}
}
