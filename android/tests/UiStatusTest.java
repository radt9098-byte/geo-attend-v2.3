import com.geoattend.app.UiStatus;
public final class UiStatusTest {
 private static void expect(String expected,boolean running,boolean offline,boolean working,long age,String status){String actual=UiStatus.label(running,offline,working,age,status);if(!expected.equals(actual))throw new AssertionError(expected+" != "+actual);}
 public static void main(String[] args){
  expect("Checked in",true,false,false,1000,"checked in");
  expect("GPS uncertain",true,false,true,1000,"GPS uncertain");
  expect("Checked out",true,false,true,1000,"outside workplace");
  expect("Tracking paused",false,false,true,1000,"checked in");
  expect("Waiting for fresh GPS",true,false,true,45001,"checked in");
  expect("Offline · pending sync",true,true,false,1000,"Offline · checked in · pending sync");
  expect("Sync needs attention",true,false,true,1000,"Offline sync needs attention: error");
  expect("Location rejected",true,false,true,1000,"Mock location rejected");
  expect("Confirming exit",true,false,true,1000,"confirming exit");
  if(UiStatus.tone("Checked in")!=0||UiStatus.tone("GPS uncertain")!=1||UiStatus.tone("Checked out")!=2)throw new AssertionError("Incorrect status colour");
  System.out.println("PASS: fresh/stale GPS, offline, paused, rejected fixes, exit, sync attention and status colours.");
 }
}
