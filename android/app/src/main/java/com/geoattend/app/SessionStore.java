package com.geoattend.app;
import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
public final class SessionStore {
 private final SharedPreferences prefs;
 public SessionStore(Context c){prefs=c.getSharedPreferences("geo_private",Context.MODE_PRIVATE);}
 private SecretKey key() throws Exception {KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);if(!store.containsAlias("GeoAttendSession")){KeyGenerator g=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");g.init(new KeyGenParameterSpec.Builder("GeoAttendSession",KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());g.generateKey();}return (SecretKey)store.getKey("GeoAttendSession",null);}
 public synchronized void setToken(String token) throws Exception {Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,key());prefs.edit().putString("token",Base64.encodeToString(c.doFinal(token.getBytes(java.nio.charset.StandardCharsets.UTF_8)),Base64.NO_WRAP)).putString("iv",Base64.encodeToString(c.getIV(),Base64.NO_WRAP)).commit();}
 public synchronized String token(){try{String t=prefs.getString("token","");if(t.isEmpty())return "";Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(prefs.getString("iv",""),Base64.NO_WRAP)));return new String(c.doFinal(Base64.decode(t,Base64.NO_WRAP)),java.nio.charset.StandardCharsets.UTF_8);}catch(Exception e){clear();return "";}}
 public synchronized void savePrivate(String name,String value) throws Exception {Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,key());prefs.edit().putString(name,Base64.encodeToString(c.doFinal(value.getBytes(java.nio.charset.StandardCharsets.UTF_8)),Base64.NO_WRAP)).putString(name+"Iv",Base64.encodeToString(c.getIV(),Base64.NO_WRAP)).commit();}
 public synchronized String readPrivate(String name){try{String t=prefs.getString(name,"");if(t.isEmpty())return "";Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(prefs.getString(name+"Iv",""),Base64.NO_WRAP)));return new String(c.doFinal(Base64.decode(t,Base64.NO_WRAP)),java.nio.charset.StandardCharsets.UTF_8);}catch(Exception e){return "";}}
 public void clear(){prefs.edit().remove("token").remove("iv").remove("user").remove("cachedStatus").remove("cachedStatusIv").remove("cachedStats").remove("cachedStatsIv").remove("workCalendar").remove("workCalendarIv").putBoolean("trackingWanted",false).apply();}
 public SharedPreferences prefs(){return prefs;}
}
