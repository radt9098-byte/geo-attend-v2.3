package com.geoattend.app;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
/** Historical I/O has its own lane so a blocked upload cannot starve live fixes. */
public final class TrackingWork implements AutoCloseable {
 private final ExecutorService live=Executors.newSingleThreadExecutor(),history=Executors.newSingleThreadExecutor();
 public void live(Runnable job){live.execute(job);}
 public void history(Runnable job){history.execute(job);}
 @Override public void close(){live.shutdown();history.shutdown();}
}
