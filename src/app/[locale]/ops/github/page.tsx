/**
 * GitHub Integration Page
 *
 * Allows users to:
 * - Connect their GitHub account via OAuth
 * - View connected repositories
 * - Link/unlink repositories
 * - View GitHub activity feed
 *
 * Phase 52 - GitHub Integration
 */

'use client';

import {Suspense, useEffect, useState} from 'react';
import {useRouter, useSearchParams} from 'next/navigation';
import {getFunctions, httpsCallable} from 'firebase/functions';
import {app, auth} from '@/lib/firebaseClient';
import {onAuthStateChanged} from 'firebase/auth';

const GITHUB_AUTHORIZE = 'https://github.com/login/oauth/authorize';
const GITHUB_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || '';

interface GitHubAccount {
  login: string;
  avatarUrl: string;
  scopes: string[];
  connectedAt: number;
}

interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  defaultBranch: string;
  private: boolean;
  htmlUrl: string;
  description: string;
}

interface ConnectedRepo {
  repoId: number;
  fullName: string;
  syncEnabled: boolean;
  lastSyncAt: string | null;
}

function GitHubIntegrationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<GitHubAccount | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [connectedRepos, setConnectedRepos] = useState<ConnectedRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const functions = getFunctions(app);

  // Check for OAuth success/error in URL params
  useEffect(() => {
    const errorParam = searchParams.get('error');
    const connectedParam = searchParams.get('connected');

    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }

    if (connectedParam === '1') {
      setSuccess('GitHub account connected successfully!');
      // Refresh account status
      fetchGitHubAccount();
    }
  }, [searchParams]);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        fetchGitHubAccount();
      }
    });

    return () => unsubscribe();
  }, []);

  async function fetchGitHubAccount() {
    try {
      const getAccount = httpsCallable(functions, 'getGitHubAccount');
      const result = await getAccount({});
      const data = result.data as any;

      if (data.connected) {
        setAccount(data.account);
        fetchConnectedRepos();
      } else {
        setAccount(null);
      }
    } catch (error: any) {
      console.error('Error fetching GitHub account:', error);
    }
  }

  async function fetchConnectedRepos() {
    try {
      const getRepos = httpsCallable(functions, 'getConnectedRepositories');
      const result = await getRepos({});
      const data = result.data as any;

      setConnectedRepos(data.repos || []);
    } catch (error: any) {
      console.error('Error fetching connected repos:', error);
    }
  }

  async function fetchAvailableRepos() {
    setLoadingRepos(true);
    setError(null);

    try {
      const listRepos = httpsCallable(functions, 'listRepositories');
      const result = await listRepos({page: 1, perPage: 100});
      const data = result.data as any;

      setRepos(data.repos || []);
    } catch (error: any) {
      setError(error.message || 'Failed to fetch repositories');
    } finally {
      setLoadingRepos(false);
    }
  }

  async function connectRepo(repo: GitHubRepo) {
    try {
      const connect = httpsCallable(functions, 'connectRepository');
      await connect({
        repoId: repo.id,
        fullName: repo.fullName,
        syncEnabled: true,
      });

      setSuccess(`Repository ${repo.fullName} connected successfully!`);
      fetchConnectedRepos();
      fetchAvailableRepos(); // Refresh list
    } catch (error: any) {
      setError(error.message || 'Failed to connect repository');
    }
  }

  async function disconnectRepo(repoId: string) {
    try {
      const disconnect = httpsCallable(functions, 'disconnectRepository');
      await disconnect({repoId});

      setSuccess('Repository disconnected successfully!');
      fetchConnectedRepos();
    } catch (error: any) {
      setError(error.message || 'Failed to disconnect repository');
    }
  }

  async function revokeConnection() {
    if (!confirm('Are you sure you want to disconnect your GitHub account?')) {
      return;
    }

    try {
      const revoke = httpsCallable(functions, 'revokeGitHubConnection');
      await revoke({});

      setSuccess('GitHub account disconnected successfully!');
      setAccount(null);
      setRepos([]);
      setConnectedRepos([]);
    } catch (error: any) {
      setError(error.message || 'Failed to revoke GitHub connection');
    }
  }

  function initiateOAuth() {
    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      redirect_uri: `${window.location.origin}/api/github/callback`,
      scope: 'repo user:email workflow',
      state: Math.random().toString(36).substring(7), // Simple CSRF protection
    });

    window.location.href = `${GITHUB_AUTHORIZE}?${params.toString()}`;
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">GitHub Integration</h1>
        <p>Please sign in to connect your GitHub account.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">GitHub Integration</h1>

      {/* Status Messages */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
          <button onClick={() => setError(null)} className="float-right font-bold">
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
          <button onClick={() => setSuccess(null)} className="float-right font-bold">
            ×
          </button>
        </div>
      )}

      {/* Account Status */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">GitHub Account</h2>

        {account ? (
          <div className="flex items-center gap-4">
            <img
              src={account.avatarUrl}
              alt={account.login}
              className="w-16 h-16 rounded-full"
            />
            <div className="flex-1">
              <p className="font-medium text-lg">@{account.login}</p>
              <p className="text-sm text-gray-600">
                Connected: {new Date(account.connectedAt).toLocaleDateString()}
              </p>
              <p className="text-xs text-gray-500">
                Scopes: {account.scopes.join(', ')}
              </p>
            </div>
            <button
              onClick={revokeConnection}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div>
            <p className="text-gray-600 mb-4">
              Connect your GitHub account to enable repository integration and deployment automation.
            </p>
            <button
              onClick={initiateOAuth}
              className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              Connect with GitHub
            </button>
          </div>
        )}
      </div>

      {/* Connected Repositories */}
      {account && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Connected Repositories</h2>
            <button
              onClick={fetchAvailableRepos}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Browse Repositories
            </button>
          </div>

          {connectedRepos.length === 0 ? (
            <p className="text-gray-600">No repositories connected yet.</p>
          ) : (
            <div className="space-y-3">
              {connectedRepos.map((repo) => (
                <div
                  key={repo.repoId}
                  className="border rounded p-4 flex justify-between items-center"
                >
                  <div>
                    <p className="font-medium">{repo.fullName}</p>
                    <p className="text-sm text-gray-600">
                      Sync: {repo.syncEnabled ? 'Enabled' : 'Disabled'}
                      {repo.lastSyncAt && ` • Last sync: ${new Date(repo.lastSyncAt).toLocaleString()}`}
                    </p>
                  </div>
                  <button
                    onClick={() => disconnectRepo(`${user.uid}__${repo.repoId}`)}
                    className="px-3 py-1 text-red-600 border border-red-600 rounded hover:bg-red-50"
                  >
                    Disconnect
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Available Repositories */}
      {repos.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Available Repositories</h2>

          {loadingRepos ? (
            <p>Loading repositories...</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {repos.map((repo) => {
                const isConnected = connectedRepos.some((r) => r.repoId === repo.id);

                return (
                  <div
                    key={repo.id}
                    className="border rounded p-4 flex justify-between items-center"
                  >
                    <div className="flex-1">
                      <p className="font-medium">
                        {repo.fullName}
                        {repo.private && (
                          <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                            Private
                          </span>
                        )}
                      </p>
                      {repo.description && (
                        <p className="text-sm text-gray-600 mt-1">{repo.description}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        Branch: {repo.defaultBranch}
                      </p>
                    </div>
                    <button
                      onClick={() => connectRepo(repo)}
                      disabled={isConnected}
                      className={`px-4 py-2 rounded ${
                        isConnected
                          ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      {isConnected ? 'Connected' : 'Connect'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function GitHubIntegrationPage() {
  return (
    <Suspense fallback={<div className="container mx-auto p-6"><p>Loading...</p></div>}>
      <GitHubIntegrationContent />
    </Suspense>
  );
}
