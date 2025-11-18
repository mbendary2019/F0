'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function GithubCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Connecting your GitHub account...');

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      console.error('[GitHub OAuth] Error from GitHub:', error);
      setStatus('Error: ' + error);
      setTimeout(() => {
        router.replace('/ar/settings/integrations?github=error');
      }, 2000);
      return;
    }

    if (!code) {
      console.error('[GitHub OAuth] Missing "code" param in callback URL');
      setStatus('Error: Missing authorization code');
      setTimeout(() => {
        router.replace('/ar/settings/integrations?github=missing_code');
      }, 2000);
      return;
    }

    console.log('[GitHub OAuth] Received code, exchanging for token...');

    // Exchange code for access token
    exchangeToken(code);
  }, [router, searchParams]);

  const exchangeToken = async (code: string) => {
    try {
      setStatus('Exchanging authorization code...');

      const response = await fetch('/api/auth/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect GitHub');
      }

      console.log('[GitHub OAuth] ✅ Success!', data);
      setStatus(`✅ Connected as ${data.user?.login || 'GitHub user'}!`);

      setTimeout(() => {
        router.replace('/ar/settings/integrations?github=success');
      }, 1500);
    } catch (error: any) {
      console.error('[GitHub OAuth] Error:', error);
      setStatus('❌ Error: ' + error.message);
      setTimeout(() => {
        router.replace('/ar/settings/integrations?github=error');
      }, 2000);
    }
  };

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '20px',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #3498db',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      <p style={{ textAlign: 'center', color: '#666' }}>{status}</p>
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
