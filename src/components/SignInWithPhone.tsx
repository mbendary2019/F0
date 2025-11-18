'use client';
import { useEffect, useRef, useState } from 'react';
import { auth } from '@/lib/firebaseClient';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

export default function SignInWithPhone({ onLogin }:{ onLogin: ()=>void }){
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const confirmationRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(()=>{
    if (!(window as any).recaptchaVerifier){
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible'
      });
      setReady(true);
    }
  },[]);

  async function sendCode(){
    try{
      const appVerifier = (window as any).recaptchaVerifier;
      const conf = await signInWithPhoneNumber(auth, phone, appVerifier);
      confirmationRef.current = conf;
      alert('تم إرسال كود SMS');
    }catch(e:any){ console.error(e); alert(e?.message || 'SMS error'); }
  }

  async function verify(){
    try{
      const cred = await confirmationRef.current.confirm(code);
      const idToken = await cred.user.getIdToken();
      const r = await fetch('/api/sessionLogin', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ idToken })
      });
      if(r.ok){ onLogin(); }
      else { console.error(await r.text()); alert('Session failed'); }
    }catch(e:any){ console.error(e); alert(e?.message || 'Verify error'); }
  }

  return (
    <div>
      <div id="recaptcha-container" />
      <input placeholder="+9655xxxxxxx" value={phone} onChange={e=>setPhone(e.target.value)} />
      <button onClick={sendCode} disabled={!ready}>إرسال الكود</button>
      <input placeholder="123456" value={code} onChange={e=>setCode(e.target.value)} />
      <button onClick={verify}>تأكيد</button>
    </div>
  );
}
