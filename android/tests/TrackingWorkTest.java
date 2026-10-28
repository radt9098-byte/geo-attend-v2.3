import com.geoattend.app.TrackingWork;
import com.geoattend.app.TrackingHealth;
import java.util.concurrent.*;
public final class TrackingWorkTest {
 public static void main(String[] args)throws Exception{
  try(TrackingWork work=new TrackingWork()){
   CountDownLatch historyStarted=new CountDownLatch(1),releaseHistory=new CountDownLatch(1),fixAccepted=new CountDownLatch(1);
   work.history(()->{historyStarted.countDown();try{releaseHistory.await();}catch(InterruptedException e){Thread.currentThread().interrupt();}});
   if(!historyStarted.await(2,TimeUnit.SECONDS))throw new AssertionError("History did not start");
   try{work.live(fixAccepted::countDown);if(!fixAccepted.await(2,TimeUnit.SECONDS))throw new AssertionError("An offline upload blocked a current GPS fix");}finally{releaseHistory.countDown();}
  }
  long now=1_800_000;
  if(!TrackingHealth.label("gps_off",now-15000,0,now,false).equals("GPS off"))throw new AssertionError();
  if(!TrackingHealth.label("uncertain",now-15000,0,now,false).equals("GPS uncertain"))throw new AssertionError();
  if(!TrackingHealth.label("inside",now-400000,now-400000,now,false).equals("No recent connection"))throw new AssertionError();
  if(!TrackingHealth.label("inside",now-1000,now-1000,now,true).startsWith("Saved status"))throw new AssertionError();
  if(!TrackingHealth.label("sync_attention",now-1000,now-1000,now,false).contains("Online"))throw new AssertionError();
  if(!TrackingHealth.label("paused",now-1000,0,now,false).equals("Tracking paused"))throw new AssertionError();
  System.out.println("PASS: blocked history upload cannot block live location; advisory health distinguishes uncertain GPS, GPS off, stale connection, cached admin data and paused tracking.");
 }
}
