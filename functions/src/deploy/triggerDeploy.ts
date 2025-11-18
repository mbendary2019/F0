/**
 * Trigger Deploy — Cloud Function
 *
 * Initiates a deployment to Firebase, Vercel, or GitHub Pages
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import {db} from '../config';
import {Timestamp, FieldValue} from 'firebase-admin/firestore';
import {execSync} from 'child_process';
import fetch from 'node-fetch';

interface DeployTriggerRequest {
  target: 'firebase' | 'vercel' | 'github-pages';
  env: 'production' | 'staging' | 'preview' | 'custom';
  config?: any;
}

interface DeployLog {
  timestamp: Timestamp;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  metadata?: Record<string, any>;
}

/**
 * Add log entry to deployment job
 */
async function addLog(
  jobId: string,
  level: DeployLog['level'],
  message: string,
  metadata?: Record<string, any>
): Promise<void> {
  const log: DeployLog = {
    timestamp: Timestamp.now(),
    level,
    message,
    metadata,
  };

  await db.collection('ops_deploy_jobs').doc(jobId).update({
    logs: FieldValue.arrayUnion(log),
    updatedAt: Timestamp.now(),
  });
}

/**
 * Update deployment job status
 */
async function updateStatus(
  jobId: string,
  status: 'queued' | 'deploying' | 'success' | 'failed' | 'cancelled',
  additionalData?: Record<string, any>
): Promise<void> {
  const updateData: any = {
    status,
    updatedAt: Timestamp.now(),
  };

  if (status === 'deploying' && !additionalData?.startTime) {
    updateData.startTime = Timestamp.now();
  }

  if (status === 'success' || status === 'failed') {
    updateData.endTime = Timestamp.now();
  }

  if (additionalData) {
    Object.assign(updateData, additionalData);
  }

  await db.collection('ops_deploy_jobs').doc(jobId).update(updateData);
}

/**
 * Deploy to Firebase Hosting
 */
async function deployToFirebase(jobId: string, config: any): Promise<void> {
  await addLog(jobId, 'info', 'Starting Firebase deployment...');

  try {
    const projectId = config?.firebase?.projectId || process.env.FIREBASE_PROJECT_ID;
    const targets = config?.firebase?.targets || ['hosting'];

    await addLog(jobId, 'info', `Deploying to Firebase project: ${projectId}`);
    await addLog(jobId, 'info', `Targets: ${targets.join(', ')}`);

    // Build the project first
    await addLog(jobId, 'info', 'Running build command...');
    execSync('npm run build', {cwd: process.cwd(), stdio: 'pipe'});
    await addLog(jobId, 'success', 'Build completed successfully');

    // Deploy to Firebase
    const deployCommand = `firebase deploy --only ${targets.join(',')} --project ${projectId}`;
    await addLog(jobId, 'info', `Executing: ${deployCommand}`);

    const output = execSync(deployCommand, {
      cwd: process.cwd(),
      stdio: 'pipe',
      encoding: 'utf-8',
    });

    await addLog(jobId, 'success', 'Firebase deployment completed');
    await addLog(jobId, 'info', output);

    // Extract URL from output
    const urlMatch = output.match(/Hosting URL: (https:\/\/[^\s]+)/);
    const resultUrl = urlMatch ? urlMatch[1] : `https://${projectId}.web.app`;

    await updateStatus(jobId, 'success', {
      resultUrl,
      deploymentId: `firebase-${Date.now()}`,
    });
  } catch (error: any) {
    await addLog(jobId, 'error', `Deployment failed: ${error.message}`);
    await updateStatus(jobId, 'failed', {
      errorMessage: error.message,
      errorStack: error.stack,
    });
    throw error;
  }
}

/**
 * Deploy to Vercel
 */
async function deployToVercel(jobId: string, config: any): Promise<void> {
  await addLog(jobId, 'info', 'Starting Vercel deployment...');

  try {
    const vercelToken = process.env.VERCEL_TOKEN || config?.vercel?.token;
    const projectId = config?.vercel?.projectId;
    const production = config?.env === 'production';

    if (!vercelToken) {
      throw new Error('Vercel token not configured');
    }

    await addLog(jobId, 'info', `Deploying to Vercel (production: ${production})`);

    // Trigger Vercel deployment via API
    const response = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vercelToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectId,
        gitSource: config?.vercel?.gitSource,
        target: production ? 'production' : 'preview',
        projectSettings: {
          buildCommand: config?.build?.command || 'npm run build',
          outputDirectory: config?.build?.outputDirectory || 'out',
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Vercel API error: ${error}`);
    }

    const deployment: any = await response.json();
    await addLog(jobId, 'success', 'Vercel deployment initiated');
    await addLog(jobId, 'info', `Deployment ID: ${deployment.id}`);

    // Poll deployment status
    let status = 'BUILDING';
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    while (status === 'BUILDING' && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds

      const statusResponse = await fetch(
        `https://api.vercel.com/v13/deployments/${deployment.id}`,
        {
          headers: {'Authorization': `Bearer ${vercelToken}`},
        }
      );

      const statusData: any = await statusResponse.json();
      status = statusData.readyState;

      await addLog(jobId, 'info', `Deployment status: ${status}`);
      attempts++;
    }

    if (status === 'READY') {
      await updateStatus(jobId, 'success', {
        resultUrl: deployment.url,
        deploymentId: deployment.id,
      });
      await addLog(jobId, 'success', `Deployment live at: ${deployment.url}`);
    } else if (status === 'ERROR') {
      throw new Error('Vercel deployment failed');
    } else {
      await addLog(jobId, 'warning', 'Deployment is still in progress (timeout reached)');
      await updateStatus(jobId, 'deploying', {
        deploymentId: deployment.id,
      });
    }
  } catch (error: any) {
    await addLog(jobId, 'error', `Vercel deployment failed: ${error.message}`);
    await updateStatus(jobId, 'failed', {
      errorMessage: error.message,
      errorStack: error.stack,
    });
    throw error;
  }
}

/**
 * Deploy to GitHub Pages
 */
async function deployToGitHub(jobId: string, config: any): Promise<void> {
  await addLog(jobId, 'info', 'Starting GitHub Pages deployment...');

  try {
    const githubToken = process.env.GITHUB_TOKEN || config?.githubPages?.token;
    const repo = config?.githubPages?.repo;
    const branch = config?.githubPages?.branch || 'gh-pages';

    if (!githubToken || !repo) {
      throw new Error('GitHub token or repo not configured');
    }

    await addLog(jobId, 'info', `Deploying to ${repo} (branch: ${branch})`);

    // Build the project
    await addLog(jobId, 'info', 'Running build command...');
    execSync('npm run build', {cwd: process.cwd(), stdio: 'pipe'});
    await addLog(jobId, 'success', 'Build completed');

    // Deploy using gh-pages or custom script
    await addLog(jobId, 'info', 'Pushing to GitHub Pages...');
    execSync(`npx gh-pages -d out -b ${branch} -r https://${githubToken}@github.com/${repo}.git`, {
      cwd: process.cwd(),
      stdio: 'pipe',
    });

    const resultUrl = `https://${repo.split('/')[0]}.github.io/${repo.split('/')[1]}`;

    await updateStatus(jobId, 'success', {
      resultUrl,
      deploymentId: `github-${Date.now()}`,
    });
    await addLog(jobId, 'success', `Deployment complete: ${resultUrl}`);
  } catch (error: any) {
    await addLog(jobId, 'error', `GitHub Pages deployment failed: ${error.message}`);
    await updateStatus(jobId, 'failed', {
      errorMessage: error.message,
      errorStack: error.stack,
    });
    throw error;
  }
}

/**
 * Main Trigger Deploy Function
 */
export const triggerDeploy = onCall(
  {
    timeoutSeconds: 540, // 9 minutes
    memory: '2GiB',
    region: 'us-central1',
  },
  async (request) => {
    const data = request.data as DeployTriggerRequest;

    // Check authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = request.auth.uid;

    // Validate request
    if (!data.target || !data.env) {
      throw new HttpsError('invalid-argument', 'Missing required fields: target, env');
    }

    // Create deployment job
    const jobRef = db.collection('ops_deploy_jobs').doc();
    const jobId = jobRef.id;

    await jobRef.set({
      id: jobId,
      userId,
      target: data.target,
      env: data.env,
      status: 'queued',
      logs: [],
      config: data.config || {},
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // Start deployment asynchronously
    (async () => {
      try {
        await updateStatus(jobId, 'deploying');

        switch (data.target) {
          case 'firebase':
            await deployToFirebase(jobId, data.config);
            break;
          case 'vercel':
            await deployToVercel(jobId, data.config);
            break;
          case 'github-pages':
            await deployToGitHub(jobId, data.config);
            break;
          default:
            throw new Error(`Unsupported target: ${data.target}`);
        }
      } catch (error: any) {
        console.error('Deployment error:', error);
        // Error handling already done in individual functions
      }
    })();

    return {
      success: true,
      jobId,
      message: 'Deployment started',
    };
  });
