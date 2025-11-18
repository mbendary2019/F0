'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { functions, firestore } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface FirebaseProject {
  projectId: string;
  displayName: string;
  projectNumber: string;
}

interface ProjectIntegrations {
  firebase?: {
    firebaseProjectId?: string;
    appId?: string;
    config?: any;
    authProviders?: string[];
  };
  vercel?: {
    projectId?: string;
  };
  domain?: {
    name?: string;
  };
}

export default function ProjectIntegrationsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const locale = params.locale as string;

  // Validation check
  if (!projectId) {
    console.error('[Project Integrations] ERROR: projectId is undefined → routing issue');
    return (
      <div className="container mx-auto py-8 px-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Error: Invalid Project ID</AlertDescription>
        </Alert>
      </div>
    );
  }

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [setupInProgress, setSetupInProgress] = useState(false);

  const [firebaseProjects, setFirebaseProjects] = useState<FirebaseProject[]>([]);
  const [selectedFirebaseProject, setSelectedFirebaseProject] = useState<string>('');
  const [selectedAuthProviders, setSelectedAuthProviders] = useState<string[]>([]);

  const [integrations, setIntegrations] = useState<ProjectIntegrations>({});
  const [setupComplete, setSetupComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load existing integrations from ops_projects (where autoSetupFirebase saves)
      const integrationsDoc = await getDoc(
        doc(firestore, 'ops_projects', projectId, 'integrations', 'firebase')
      );

      if (integrationsDoc.exists()) {
        const data = integrationsDoc.data();
        setIntegrations({ firebase: data as any });
        setSelectedFirebaseProject(data.firebaseProjectId || '');
        setSelectedAuthProviders(data.authProvidersEnabled || data.authProviders || []);
        setSetupComplete(!!(data.firebaseConfig || data.config));
      }

      // Load available Firebase projects
      const listProjects = httpsCallable<void, { projects: FirebaseProject[] }>(
        functions,
        'listFirebaseProjects'
      );

      const result = await listProjects();
      setFirebaseProjects(result.data.projects);
    } catch (err: any) {
      console.error('[Project Integrations] Load error:', err);
      setError(err.message || 'Failed to load integrations');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoSetup = async () => {
    if (!selectedFirebaseProject) {
      alert('Please select a Firebase project first');
      return;
    }

    setSetupInProgress(true);
    setError(null);

    try {
      console.log('[Auto Setup] Starting auto-setup...');

      // Call the new autoSetupFirebase function that does everything in one go!
      const autoSetup = httpsCallable<
        { firebaseProjectId: string; f0ProjectId: string },
        {
          ok: boolean;
          firebaseProjectId: string;
          appId: string;
          config: any;
          steps: {
            webApp: string;
            config: string;
            authProviders: string;
            firestoreRules: string;
            savedToFirestore: string;
          };
        }
      >(functions, 'autoSetupFirebase');

      const result = await autoSetup({
        firebaseProjectId: selectedFirebaseProject,
        f0ProjectId: projectId,
      });

      if (result.data.ok) {
        console.log('✅ [Auto Setup] Complete!', result.data.steps);

        // Reload data to show the new configuration
        await loadData();
        setSetupComplete(true);

        alert(
          `✅ Firebase setup completed successfully!\n\n` +
          `Web App: ${result.data.steps.webApp}\n` +
          `Config: ${result.data.steps.config}\n` +
          `Auth: ${result.data.steps.authProviders}\n` +
          `Rules: ${result.data.steps.firestoreRules}\n` +
          `Saved: ${result.data.steps.savedToFirestore}`
        );
      } else {
        throw new Error('Auto-setup returned unexpected response');
      }
    } catch (err: any) {
      console.error('[Auto Setup] Error:', err);
      setError(err.message || 'Auto setup failed');
      alert(`Setup failed: ${err.message}`);
    } finally {
      setSetupInProgress(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      // Save basic selection (without auto-setup)
      await setDoc(
        doc(firestore, 'projects', projectId, 'integrations', 'firebase'),
        {
          firebaseProjectId: selectedFirebaseProject,
          authProviders: selectedAuthProviders,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      alert('✅ Integration settings saved!');
    } catch (err: any) {
      console.error('[Save] Error:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Project Integrations</h1>
        <p className="text-muted-foreground">
          Connect this project to Firebase, Vercel, and other services
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {setupComplete && (
        <Alert className="mb-6">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            ✅ Firebase is fully configured for this project!
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        {/* Firebase Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">🔥</span>
                  Firebase
                </CardTitle>
                <CardDescription>
                  Automatically setup Firebase with one click
                </CardDescription>
              </div>
              {setupComplete && (
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Firebase Project Selection */}
            <div className="space-y-2">
              <Label>Firebase Project</Label>
              <Select
                value={selectedFirebaseProject}
                onValueChange={setSelectedFirebaseProject}
                disabled={setupComplete}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a Firebase project..." />
                </SelectTrigger>
                <SelectContent>
                  {firebaseProjects.map((project) => (
                    <SelectItem key={project.projectId} value={project.projectId}>
                      {project.displayName} ({project.projectId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {firebaseProjects.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No Firebase projects found. Please connect Firebase in{' '}
                  <a href={`/${locale}/settings/integrations`} className="underline">
                    Settings
                  </a>
                </p>
              )}
            </div>

            {/* Auth Providers Selection */}
            <div className="space-y-2">
              <Label>Authentication Providers</Label>
              <div className="grid grid-cols-2 gap-2">
                {['Google', 'Email', 'GitHub', 'Phone'].map((provider) => (
                  <label
                    key={provider}
                    className="flex items-center gap-2 p-3 border rounded cursor-pointer hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAuthProviders.includes(provider.toLowerCase())}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAuthProviders([
                            ...selectedAuthProviders,
                            provider.toLowerCase(),
                          ]);
                        } else {
                          setSelectedAuthProviders(
                            selectedAuthProviders.filter((p) => p !== provider.toLowerCase())
                          );
                        }
                      }}
                      disabled={setupComplete}
                    />
                    <span>{provider}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Setup Status */}
            {(integrations.firebase?.firebaseConfig || integrations.firebase?.config) && (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">Configuration</h4>
                <div className="text-sm space-y-1">
                  <p>
                    <strong>App ID:</strong>{' '}
                    {integrations.firebase.firebaseWebAppId || integrations.firebase.appId}
                  </p>
                  <p>
                    <strong>Project ID:</strong>{' '}
                    {(integrations.firebase.firebaseConfig || integrations.firebase.config)
                      ?.projectId}
                  </p>
                  <p>
                    <strong>Auth Domain:</strong>{' '}
                    {(integrations.firebase.firebaseConfig || integrations.firebase.config)
                      ?.authDomain}
                  </p>
                  {integrations.firebase.authProvidersEnabled && (
                    <p>
                      <strong>Auth Providers:</strong>{' '}
                      {integrations.firebase.authProvidersEnabled.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {!setupComplete ? (
                <>
                  <Button
                    onClick={handleAutoSetup}
                    disabled={!selectedFirebaseProject || setupInProgress}
                    className="flex-1"
                  >
                    {setupInProgress ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Setting up Firebase...
                      </>
                    ) : (
                      <>🚀 Auto-Setup Firebase</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleSave}
                    disabled={!selectedFirebaseProject || saving}
                  >
                    {saving ? 'Saving...' : 'Save Settings'}
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => setSetupComplete(false)}>
                  Reconfigure
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Coming Soon: Vercel, GoDaddy */}
        <Card className="opacity-60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">▲</span>
              Vercel (Coming Soon)
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="opacity-60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">🌐</span>
              Domain Management (Coming Soon)
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
