'use client';

import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { GodaddyConnectDialog } from '@/features/integrations/GodaddyConnectDialog';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'connected' | 'disconnected';
  scopes?: string[];
}

interface IntegrationStatus {
  firebase: boolean;
  vercel: boolean;
  godaddy: boolean;
  github: boolean;
}

export default function IntegrationsPage() {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [firebaseConnected, setFirebaseConnected] = useState(false);
  const [firebaseProjects, setFirebaseProjects] = useState<any[] | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isGodaddyDialogOpen, setIsGodaddyDialogOpen] = useState(false);
  const [status, setStatus] = useState<IntegrationStatus>({
    firebase: false,
    vercel: false,
    godaddy: false,
    github: false,
  });

  const integrations: Integration[] = [
    {
      id: 'firebase',
      name: 'Firebase',
      description: 'Connect your Google account to manage Firebase projects',
      icon: '🔥',
      status: firebaseConnected ? 'connected' : 'disconnected',
      scopes: [
        'https://www.googleapis.com/auth/cloud-platform',
        'https://www.googleapis.com/auth/firebase',
      ],
    },
    {
      id: 'vercel',
      name: 'Vercel',
      description: 'Deploy your projects to Vercel automatically',
      icon: '▲',
      status: status.vercel ? 'connected' : 'disconnected',
    },
    {
      id: 'godaddy',
      name: 'GoDaddy',
      description: 'Manage domains and DNS settings',
      icon: '🌐',
      status: status.godaddy ? 'connected' : 'disconnected',
    },
    {
      id: 'github',
      name: 'GitHub',
      description: 'Connect repositories and enable CI/CD',
      icon: '🐙',
      status: status.github ? 'connected' : 'disconnected',
    },
  ];

  useEffect(() => {
    // TODO: Add auth check when useAuthClaims is available
    loadIntegrationStatus();
    checkVercelStatus();
  }, []);

  const loadIntegrationStatus = async () => {
    try {
      setLoading(true);
      const getStatus = httpsCallable<void, IntegrationStatus>(
        functions,
        'getIntegrationStatus'
      );
      const result = await getStatus();
      setStatus(result.data);
    } catch (error) {
      console.error('[Integrations] Failed to load status:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkVercelStatus = async () => {
    try {
      console.log('[Vercel] Checking connection status...');
      const vercelDoc = doc(db, 'ops_integrations', 'vercelAdmin');
      const snapshot = await getDoc(vercelDoc);

      const isConnected = snapshot.exists();
      console.log('[Vercel] Connection status:', isConnected);

      setStatus((prev) => ({
        ...prev,
        vercel: isConnected,
      }));
    } catch (error) {
      console.error('[Vercel] Failed to check status:', error);
    }
  };

  const handleConnect = async (integrationId: string) => {
    setConnecting(integrationId);

    try {
      if (integrationId === 'firebase') {
        await connectFirebase();
      } else if (integrationId === 'vercel') {
        await connectVercel();
      } else if (integrationId === 'godaddy') {
        await connectGoDaddy();
      } else if (integrationId === 'github') {
        await connectGitHub();
      }

      // Reload status
      await loadIntegrationStatus();
    } catch (error) {
      console.error(`[Integrations] Failed to connect ${integrationId}:`, error);
      alert(`Failed to connect ${integrationId}. Please try again.`);
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    if (!confirm(`Are you sure you want to disconnect ${integrationId}?`)) {
      return;
    }

    try {
      const disconnect = httpsCallable<{ provider: string }, { success: boolean }>(
        functions,
        'disconnectIntegration'
      );
      await disconnect({ provider: integrationId });
      await loadIntegrationStatus();
    } catch (error) {
      console.error(`[Integrations] Failed to disconnect ${integrationId}:`, error);
      alert(`Failed to disconnect ${integrationId}. Please try again.`);
    }
  };

  const connectFirebase = async () => {
    // TEST MODE: Call testFirebaseAdmin instead of OAuth
    try {
      console.log('[Test] Calling testFirebaseAdmin function...');
      const test = httpsCallable(functions, 'testFirebaseAdmin');
      const res = await test({});
      const data = res.data as any;

      console.log('[Test] Response:', data);

      if (data.ok) {
        setFirebaseConnected(true);
        alert('✅ Firebase Service Account is working!\n\n' + JSON.stringify(data, null, 2));
      } else {
        setFirebaseConnected(false);
        alert('⚠️ Unexpected response format');
      }
    } catch (err: any) {
      console.error('[Test] Error:', err);
      setFirebaseConnected(false);
      alert('❌ Firebase Service Account NOT working\n\n' + err.message);
    }

    // ORIGINAL OAUTH CODE (commented out for testing)
    // const scopes = [
    //   'https://www.googleapis.com/auth/cloud-platform',
    //   'https://www.googleapis.com/auth/firebase',
    //   'https://www.googleapis.com/auth/identitytoolkit',
    // ].join(' ');

    // const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    //   client_id: process.env.NEXT_PUBLIC_FIREBASE_CLIENT_ID || '',
    //   redirect_uri: `${window.location.origin}/auth/callback/google`,
    //   response_type: 'code',
    //   scope: scopes,
    //   access_type: 'offline',
    //   prompt: 'consent',
    // })}`;

    // const width = 600;
    // const height = 700;
    // const left = window.screen.width / 2 - width / 2;
    // const top = window.screen.height / 2 - height / 2;

    // const popup = window.open(
    //   authUrl,
    //   'Firebase OAuth',
    //   `width=${width},height=${height},left=${left},top=${top}`
    // );

    // return new Promise<void>((resolve, reject) => {
    //   const checkPopup = setInterval(() => {
    //     if (popup?.closed) {
    //       clearInterval(checkPopup);
    //       loadIntegrationStatus().then(resolve).catch(reject);
    //     }
    //   }, 500);
    // });
  };

  const connectVercel = async () => {
    // Phase 72: Manual Token Mode - Test via Cloud Function
    try {
      console.log('[Vercel] Testing token...');
      setConnecting('vercel');

      const fn = httpsCallable(functions, 'testVercelToken');
      const res = await fn({});
      const data = res.data as any;

      if (data.ok) {
        alert(`✅ Vercel Connected!\n\nUser: ${data.user?.name || data.user?.username || data.user?.email}\nProjects: ${data.projects?.length || 0}`);

        setStatus(prev => ({
          ...prev,
          vercel: true
        }));
      } else {
        alert('⚠️ Vercel token exists but API returned error.');
      }
    } catch (err: any) {
      console.error('[Vercel] Error:', err);
      alert(`❌ Vercel Connection Failed\n\n${err.message}`);
    } finally {
      setConnecting(null);
    }
  };

  const connectGoDaddy = async () => {
    // Open the GoDaddy dialog instead of using prompt()
    setIsGodaddyDialogOpen(true);
  };

  const connectGitHub = async () => {
    // GitHub OAuth
    const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
    if (!clientId) {
      alert('GitHub integration not configured');
      return;
    }

    const authUrl = `https://github.com/login/oauth/authorize?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${window.location.origin}/auth/callback/github`,
      scope: 'repo,read:user,user:email',
    })}`;

    window.open(authUrl, '_blank');
  };

  const handleConfigureFirebase = async () => {
    try {
      console.log('[Firebase] Loading projects...');
      const fn = httpsCallable(functions, 'listFirebaseProjects');
      const res = await fn({});
      const data = res.data as any;

      setFirebaseProjects(data.projects || []);
      setIsConfigOpen(true);
    } catch (err) {
      console.error('[Firebase] Failed to load projects:', err);
      alert('Failed to load Firebase projects. Please try again.');
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Integrations</h1>
        <p className="text-muted-foreground">
          Connect external services to enhance your F0 experience
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {integrations.map((integration) => (
            <Card key={integration.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-4xl">{integration.icon}</div>
                    <div>
                      <CardTitle>{integration.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {integration.description}
                      </CardDescription>
                    </div>
                  </div>
                  {integration.status === 'connected' ? (
                    <Badge variant="default" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      <XCircle className="h-3 w-3" />
                      Not Connected
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  {integration.status === 'disconnected' ? (
                    <Button
                      onClick={() => handleConnect(integration.id)}
                      disabled={connecting === integration.id}
                      className="w-full"
                    >
                      {connecting === integration.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Connect
                        </>
                      )}
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => handleDisconnect(integration.id)}
                        className="flex-1"
                      >
                        Disconnect
                      </Button>
                      <Button
                        variant="default"
                        className="flex-1"
                        onClick={() => {
                          if (integration.id === 'firebase') {
                            handleConfigureFirebase();
                          }
                        }}
                      >
                        Configure
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-8 p-4 border rounded-lg bg-muted/50">
        <h3 className="font-semibold mb-2">Security Notice</h3>
        <p className="text-sm text-muted-foreground">
          All integration tokens are stored securely in an encrypted vault. F0 only requests
          the minimum required permissions and never shares your credentials with third
          parties.
        </p>
      </div>

      {/* Firebase Projects Modal */}
      {isConfigOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg shadow-xl max-w-2xl w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Firebase Projects</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsConfigOpen(false)}
              >
                ✕
              </Button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {firebaseProjects && firebaseProjects.length > 0 ? (
                firebaseProjects.map((project: any) => (
                  <div
                    key={project.projectId}
                    className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  >
                    <div className="font-semibold">{project.displayName}</div>
                    <div className="text-sm text-muted-foreground">
                      {project.projectId}
                    </div>
                    {project.projectNumber && (
                      <div className="text-xs text-muted-foreground">
                        Project #: {project.projectNumber}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No Firebase projects found
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsConfigOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* GoDaddy Connect Dialog */}
      <GodaddyConnectDialog
        open={isGodaddyDialogOpen}
        onOpenChange={setIsGodaddyDialogOpen}
        onSaved={loadIntegrationStatus}
      />
    </div>
  );
}
