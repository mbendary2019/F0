// functions/src/integrations/github/client.ts
// Phase 83.1: GitHub API Client using Octokit

import { Octokit } from '@octokit/rest';

/**
 * Get Octokit instance with authentication
 * Uses GITHUB_TOKEN from environment variables
 */
export function getOctokit(): Octokit {
  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    console.warn('[GitHub] GITHUB_TOKEN not set - GitHub features will not work');
    // Return unauthenticated client for now (will fail on auth-required operations)
    return new Octokit();
  }

  return new Octokit({
    auth: githubToken,
    baseUrl: process.env.GITHUB_API_URL || 'https://api.github.com',
  });
}

/**
 * Get repository information
 */
export async function getRepo(owner: string, repo: string) {
  const octokit = getOctokit();
  const { data } = await octokit.repos.get({ owner, repo });
  return data;
}

/**
 * Get default branch of a repository
 */
export async function getDefaultBranch(owner: string, repo: string): Promise<string> {
  const repoData = await getRepo(owner, repo);
  return repoData.default_branch;
}

/**
 * Create a new branch from an existing branch
 */
export async function createBranch(
  owner: string,
  repo: string,
  fromBranch: string,
  newBranch: string
): Promise<string> {
  const octokit = getOctokit();

  // Get ref of source branch
  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${fromBranch}`,
  });

  // Create new branch
  await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${newBranch}`,
    sha: refData.object.sha,
  });

  return refData.object.sha;
}

/**
 * Get file content from repository
 */
export async function getFileContent(
  owner: string,
  repo: string,
  path: string,
  ref: string = 'main'
): Promise<string> {
  const octokit = getOctokit();

  const { data } = await octokit.repos.getContent({
    owner,
    repo,
    path,
    ref,
  });

  if (!('content' in data)) {
    throw new Error(`Path ${path} is not a file`);
  }

  const buff = Buffer.from(data.content, 'base64');
  return buff.toString('utf8');
}

/**
 * List files in repository tree (recursive)
 */
export async function listTree(owner: string, repo: string, branch: string) {
  const octokit = getOctokit();

  // Get branch ref
  const { data: ref } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });

  const commitSha = ref.object.sha;

  // Get commit
  const { data: commit } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: commitSha,
  });

  const treeSha = commit.tree.sha;

  // Get tree (recursive)
  const { data: tree } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: treeSha,
    recursive: 'true',
  });

  return tree;
}

/**
 * Update file content (create or modify)
 */
export async function updateFileOnBranch(
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch: string
): Promise<string> {
  const octokit = getOctokit();

  // Get current file SHA (if exists)
  let sha: string | undefined;
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    });
    if ('sha' in data) sha = data.sha;
  } catch (error: any) {
    // File doesn't exist, will be created
    if (error.status !== 404) throw error;
  }

  // Encode content to base64
  const encoded = Buffer.from(content, 'utf8').toString('base64');

  // Create or update file
  const { data } = await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message,
    content: encoded,
    sha,
    branch,
  });

  return data.commit.sha || '';
}

/**
 * Create a Pull Request
 */
export async function createPullRequest(
  owner: string,
  repo: string,
  title: string,
  head: string,
  base: string,
  body?: string
): Promise<{ number: number; url: string }> {
  const octokit = getOctokit();

  const { data } = await octokit.pulls.create({
    owner,
    repo,
    title,
    head,
    base,
    body,
  });

  return {
    number: data.number,
    url: data.html_url,
  };
}

// ============================================================
// TEMPORARY STUBS FOR PHASE 75+ (NOT YET IMPLEMENTED)
// ============================================================

export class GitHubClient {
  // Stub class for future implementation
}

export function parseGitHubUrl(url: string): { owner: string; repo: string } {
  // Stub function for future implementation
  throw new Error("parseGitHubUrl not yet implemented");
}

