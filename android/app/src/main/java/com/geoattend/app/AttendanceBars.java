package com.geoattend.app;
import android.content.Context;
import android.graphics.*;
import android.view.View;
import java.util.*;
/** Admin-only recorded hours; no unverified time is extrapolated. */
public final class AttendanceBars extends View {
 private final SortedMap<String,Long> values;private final int accent,muted;private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
 public AttendanceBars(Context context,SortedMap<String,Long> values,int accent,int muted){super(context);this.values=values;this.accent=accent;this.muted=muted;setContentDescription("Recorded hours chart. "+values.size()+" periods.");}
 @Override protected void onDraw(Canvas c){super.onDraw(c);float scale=getResources().getDisplayMetrics().density,left=34*scale,bottom=getHeight()-28*scale,top=24*scale,width=getWidth()-left-8*scale;double max=1;for(long v:values.values())max=Math.max(max,v/3600000.0);paint.setTextSize(10*scale);paint.setColor(muted);c.drawText(String.format(Locale.ENGLISH,"%.1f h",max),0,top,paint);c.drawText("0",12*scale,bottom,paint);float step=width/Math.max(1,values.size());int i=0;for(Map.Entry<String,Long> e:values.entrySet()){float x=left+i*step,height=(float)(e.getValue()/3600000.0/max)*(bottom-top);paint.setColor(accent);c.drawRoundRect(x+step*.2f,bottom-height,x+step*.8f,bottom,3*scale,3*scale,paint);if(i%Math.max(1,(values.size()+5)/6)==0){paint.setColor(muted);String label=e.getKey().substring(e.getKey().length()-2);c.drawText(label,x,bottom+18*scale,paint);}i++;}}
}
