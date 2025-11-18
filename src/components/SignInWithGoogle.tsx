'use client';
import { auth, googleProvider } from '@/lib/firebaseClient';
import { signInWithPopup } from 'firebase/auth';

export default function SignInWithGoogle({ onLogin }:{ onLogin: ()=>void }){
  async function onGoogle() {
    try{
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      const r = await fetch('/api/sessionLogin', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ idToken })
      });
      if(r.ok){ onLogin(); }
      else { console.error(await r.text()); alert('Session failed'); }
    }catch(e:any){
      console.error(e); alert(e?.message || 'Google sign-in error');
    }
  }
  return <button onClick={onGoogle}>دخول بجوجل</button>;
}
