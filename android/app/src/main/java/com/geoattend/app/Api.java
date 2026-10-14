package com.geoattend.app;
import android.content.Context;
import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.io.*;
public final class Api {
 public static final String BASE="https://geo-attend-office.caresystemsandcontrols.workers.dev";
 public static class Failure extends IOException {public final int code;public Failure(int c,String m){super(m);code=c;}}
 public static JSONObject call(Context c,String action,JSONObject data) throws Exception {return new JSONObject(raw(c,action,data));}
 public static String raw(Context c,String action,JSONObject data) throws Exception {
  HttpURLConnection conn=(HttpURLConnection)new URL(BASE+"/api/native?action="+action).openConnection();conn.setConnectTimeout(12000);conn.setReadTimeout(15000);conn.setInstanceFollowRedirects(false);conn.setRequestProperty("Accept","application/json");String token=new SessionStore(c).token();if(!token.isEmpty())conn.setRequestProperty("Authorization","Bearer "+token);
  try{if(data!=null){conn.setRequestMethod("POST");conn.setDoOutput(true);conn.setRequestProperty("Content-Type","application/json");try(OutputStream stream=conn.getOutputStream()){stream.write(data.toString().getBytes(StandardCharsets.UTF_8));}}int code=conn.getResponseCode();String type=conn.getContentType();if(code>=300&&code<400||type!=null&&type.contains("text/html"))throw new Failure(503,"The attendance service is still private. Its owner must enable direct Android access before you can log in.");InputStream stream=code>=400?conn.getErrorStream():conn.getInputStream();String text="";if(stream!=null)try(InputStream in=stream;ByteArrayOutputStream bytes=new ByteArrayOutputStream()){byte[] buffer=new byte[4096];int n;while((n=in.read(buffer))!=-1){bytes.write(buffer,0,n);if(bytes.size()>12_000_000)throw new IOException("Response is too large.");}text=bytes.toString("UTF-8");}if(code>=400){String message="Service error. Please try again.";try{message=new JSONObject(text).optString("error",message);}catch(Exception ignored){}throw new Failure(code,message);}return text;}finally{conn.disconnect();}
 }
 public static JSONObject body(Object... pairs) throws Exception {JSONObject j=new JSONObject();for(int i=0;i<pairs.length;i+=2)j.put((String)pairs[i],pairs[i+1]);return j;}
}
