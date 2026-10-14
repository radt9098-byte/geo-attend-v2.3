package com.geoattend.app;
/** DER to IEEE P1363 conversion for P-256 signatures returned by Android. */
public final class EcdsaSignature {
 public static byte[] toP1363(byte[] der){int[] i={0};if(read(der,i)!=48)throw new IllegalArgumentException("ECDSA sequence");int total=length(der,i);if(i[0]+total!=der.length)throw new IllegalArgumentException("ECDSA length");byte[] out=new byte[64];integer(der,i,out,0);integer(der,i,out,32);if(i[0]!=der.length)throw new IllegalArgumentException("ECDSA trailing bytes");return out;}
 private static int read(byte[] b,int[] i){if(i[0]>=b.length)throw new IllegalArgumentException("Truncated signature");return b[i[0]++]&255;}
 private static int length(byte[] b,int[] i){int n=read(b,i);if(n<128)return n;int count=n&127;if(count<1||count>2)throw new IllegalArgumentException("ECDSA length");n=0;for(int k=0;k<count;k++)n=(n<<8)|read(b,i);return n;}
 private static void integer(byte[] b,int[] i,byte[] out,int offset){if(read(b,i)!=2)throw new IllegalArgumentException("ECDSA integer");int n=length(b,i),start=i[0],end=start+n;if(n<1||start+n>b.length)throw new IllegalArgumentException("ECDSA integer length");while(n>1&&b[start]==0){start++;n--;}if(n>32)throw new IllegalArgumentException("ECDSA integer overflow");System.arraycopy(b,start,out,offset+32-n,n);i[0]=end;}
}
