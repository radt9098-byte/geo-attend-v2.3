package com.geoattend.app;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.view.View;

/** Small scalable navigation icons; no emoji or external font dependency. */
public final class NavIcon extends View {
 private final String kind;private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
 public NavIcon(Context context,String kind,int color){super(context);this.kind=kind;paint.setColor(color);paint.setStrokeWidth(1.8f);paint.setStrokeCap(Paint.Cap.ROUND);paint.setStrokeJoin(Paint.Join.ROUND);paint.setStyle(Paint.Style.STROKE);setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);}
 @Override protected void onDraw(Canvas c){super.onDraw(c);c.save();float s=Math.min(getWidth(),getHeight())/24f;c.translate((getWidth()-24*s)/2,(getHeight()-24*s)/2);c.scale(s,s);
  switch(kind){
   case "Overview":Path home=new Path();home.moveTo(3,10);home.lineTo(12,3);home.lineTo(21,10);home.lineTo(21,21);home.lineTo(15,21);home.lineTo(15,14);home.lineTo(9,14);home.lineTo(9,21);home.lineTo(3,21);home.close();paint.setStyle(Paint.Style.FILL);c.drawPath(home,paint);paint.setStyle(Paint.Style.STROKE);break;
   case "Employees":c.drawCircle(9,7,3,paint);c.drawCircle(18,8,2.5f,paint);c.drawArc(3,12,15,24,180,180,false,paint);c.drawLine(3,18,3,21,paint);c.drawLine(15,18,15,21,paint);c.drawArc(15,13,23,22,210,150,false,paint);break;
   case "Attendance":c.drawRoundRect(5,4,20,22,2,2,paint);c.drawRoundRect(9,2,16,6,1,1,paint);c.drawLine(9,11,16,11,paint);c.drawLine(9,15,16,15,paint);c.drawLine(9,19,13,19,paint);break;
   default:for(int i=0;i<8;i++){double a=i*Math.PI/4;c.drawLine((float)(12+7*Math.cos(a)),(float)(12+7*Math.sin(a)),(float)(12+10*Math.cos(a)),(float)(12+10*Math.sin(a)),paint);}c.drawCircle(12,12,7,paint);c.drawCircle(12,12,2.5f,paint);
  }c.restore();
 }
}
