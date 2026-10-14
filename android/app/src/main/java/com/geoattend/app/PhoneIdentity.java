package com.geoattend.app;
import android.content.Context;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.security.*;
import java.security.spec.ECGenParameterSpec;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.util.UUID;

/** Phone private key stays non-exportable in Android Keystore. */
public final class PhoneIdentity {
 private static final String ALIAS="GeoAttendPhone";
 private static synchronized KeyStore keyStore() throws Exception {KeyStore ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null);if(!ks.containsAlias(ALIAS)){KeyPairGenerator g=KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC,"AndroidKeyStore");g.initialize(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_SIGN|KeyProperties.PURPOSE_VERIFY).setAlgorithmParameterSpec(new ECGenParameterSpec("secp256r1")).setDigests(KeyProperties.DIGEST_SHA256).build());g.generateKeyPair();}return ks;}
 private static String hex(byte[] bytes){StringBuilder b=new StringBuilder();for(byte v:bytes)b.append(String.format(java.util.Locale.ROOT,"%02x",v&255));return b.toString();}
 public static JSONObject info() throws Exception {byte[] key=keyStore().getCertificate(ALIAS).getPublicKey().getEncoded();return new JSONObject().put("id",hex(MessageDigest.getInstance("SHA-256").digest(key))).put("key",Base64.encodeToString(key,Base64.NO_WRAP)).put("name",Build.MANUFACTURER+" "+Build.MODEL);}
 public static void sign(Context c,HttpURLConnection conn,String method,String path,String body) throws Exception {
  JSONObject info=info();SessionStore store=new SessionStore(c);long offset=store.prefs().getLong("serverOffset",0);String time=String.valueOf(System.currentTimeMillis()+offset),nonce=UUID.randomUUID().toString();String message=method+"\n"+path+"\n"+time+"\n"+nonce+"\n"+hex(MessageDigest.getInstance("SHA-256").digest(body.getBytes(StandardCharsets.UTF_8)));
  Signature signature=Signature.getInstance("SHA256withECDSA");signature.initSign((PrivateKey)keyStore().getKey(ALIAS,null));signature.update(message.getBytes(StandardCharsets.UTF_8));byte[] raw=EcdsaSignature.toP1363(signature.sign());conn.setRequestProperty("X-Geo-Device",info.getString("id"));conn.setRequestProperty("X-Geo-Time",time);conn.setRequestProperty("X-Geo-Nonce",nonce);conn.setRequestProperty("X-Geo-Signature",Base64.encodeToString(raw,Base64.NO_WRAP));
 }
}
