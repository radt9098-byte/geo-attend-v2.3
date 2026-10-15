package com.geoattend.app;
import android.graphics.*;
import android.graphics.drawable.Drawable;
import java.util.Random;
/** Stable per-foreground-session lighting; no animation or refresh timer. */
public final class AmbientDrawable extends Drawable {
 private final int base;private final int[] glow;private final float[] positions;private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
 public AmbientDrawable(String theme,long seed){boolean light="light".equals(theme);base=light?Color.rgb(246,248,242):"dark".equals(theme)?Color.rgb(17,25,22):"emerald".equals(theme)?Color.rgb(3,22,16):"slate".equals(theme)?Color.rgb(19,25,33):Color.BLACK;Random r=new Random(seed);float hue=r.nextInt(360);if("emerald".equals(theme))hue=145;if("slate".equals(theme))hue=218;if(light)hue=150;glow=new int[3];positions=new float[3];for(int i=0;i<3;i++){float h=(hue+(i-1)*42+r.nextFloat()*18+360)%360;int c=Color.HSVToColor(new float[]{h,light?.30f:.62f,light?.55f:.65f});glow[i]=Color.argb(light?35:85,Color.red(c),Color.green(c),Color.blue(c));positions[i]=.08f+i*.43f+(r.nextFloat()-.5f)*.14f;}}
 @Override public void draw(Canvas canvas){Rect b=getBounds();canvas.drawColor(base);float height=Math.min(b.height()*.56f,b.width()*1.22f);if(height<=0)return;canvas.save();canvas.clipRect(b.left,b.top,b.right,b.top+height);for(int i=0;i<3;i++){float cx=b.left+b.width()*positions[i],cy=b.top+height*.04f;paint.setShader(new RadialGradient(cx,cy,Math.max(1,height),new int[]{glow[i],Color.TRANSPARENT},new float[]{0,1},Shader.TileMode.CLAMP));canvas.drawRect(b.left,b.top,b.right,b.top+height,paint);}paint.setShader(null);canvas.restore();}
 @Override public void setAlpha(int alpha){}@Override public void setColorFilter(ColorFilter f){}@Override public int getOpacity(){return PixelFormat.OPAQUE;}
}
