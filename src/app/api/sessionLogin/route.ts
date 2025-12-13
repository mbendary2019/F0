import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest){
  try{
    const { idToken } = await req.json();
    if(!idToken) return NextResponse.json({error:'Missing idToken'}, { status:400 });
    const decoded = await adminAuth.verifyIdToken(idToken);
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    const uid = decoded.uid;
    const userRef = adminDb.collection('users').doc(uid);
    const snap = await userRef.get();
    if(!snap.exists){
      await userRef.set({
        uid, email: decoded.email || null, phone: decoded.phone_number || null,
        providers: decoded.firebase?.sign_in_provider || null,
        createdAt: new Date(), lastLoginAt: new Date()
      });
    }else{
      await userRef.update({ lastLoginAt: new Date() });
    }

    const res = NextResponse.json({ ok:true, uid });
    res.cookies.set('session', sessionCookie, {
      httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: expiresIn/1000
    });
    return res;
  }catch(e:any){
    return NextResponse.json({ error: e?.message || 'Unauthorized' }, { status: 401 });
  }
}
