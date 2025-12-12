/**
 * Phase 74: Auto GitHub Push - GitHub API Client
 * Wrapper around GitHub REST API for file operations
 */

import type { ProjectFileSnapshot } from '@/types/files';

/**
 * GitHub repository information
 */
export interface GitHubRepoInfo {
  /** Repository owner (username or organization) */
  owner: string;

  /** Repository name */
  name: string;

  /** Default branch (e.g. "main" or "master") */
  defaultBranch: string;
}

/**
 * GitHub API client for file operations
 * Uses GitHub Contents API for V1 simplicity
 * Can be upgraded to Git Data API (trees/commits) for better performance with many files
 */
export class GitHubClient {
  private token: string;
  private baseUrl = 'https://api.github.com';

  constructor(token: string) {
    this.token = token;
  }

  /**
   * Make a request to GitHub API
   */
  private async request(path: string, init: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `token ${this.token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'F0-App',
      },
    });

    const text = await response.text();
    let json: any = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // Not JSON response
    }

    if (!response.ok) {
      const errorMessage = json?.message || `GitHub API error ${response.status}`;
      console.error(`[GitHub] API error for ${path}:`, response.status, text);
      throw new Error(errorMessage);
    }

    return json;
  }

  /**
   * Get the default branch for a repository
   */
  async getDefaultBranch(owner: string, repo: string): Promise<string> {
    try {
      const repoData = await this.request(`/repos/${owner}/${repo}`, {
        method: 'GET',
      });
      return repoData.default_branch || 'main';
    } catch (error: any) {
      console.error(`[GitHub] Error getting default branch:`, error);
      throw new Error(`Failed to get default branch: ${error.message}`);
    }
  }

  /**
   * Get existing file SHA (needed for updates)
   * Returns undefined if file doesn't exist
   */
  private async getFileSha(
    repo: GitHubRepoInfo,
    filePath: string
  ): Promise<string | undefined> {
    try {
      const { owner, name, defaultBranch } = repo;
      const encodedPath = encodeURIComponent(filePath);
      const existing = await this.request(
        `/repos/${owner}/${name}/contents/${encodedPath}?ref=${defaultBranch}`,
        { method: 'GET' }
      );
      return existing.sha;
    } catch (error: any) {
      // 404 means file doesn't exist - this is expected for new files
      if (error.message.includes('Not Found') || error.message.includes('404')) {
        return undefined;
      }
      // Other errors should be logged but not thrown (we'll try to create the file anyway)
      console.warn(`[GitHub] Warning checking existing file ${filePath}:`, error.message);
      return undefined;
    }
  }

  /**
   * Create or update a single file using the Contents API
   * Returns the commit SHA
   */
  async upsertFile(
    repo: GitHubRepoInfo,
    file: ProjectFileSnapshot,
    commitMessage: string
  ): Promise<{ sha: string; content?: { sha: string } }> {
    try {
      const { owner, name, defaultBranch } = repo;

      // Get existing SHA if file exists (required for updates)
      const existingSha = await this.getFileSha(repo, file.path);

      // Convert content to base64
      const contentBase64 = Buffer.from(file.content, 'utf8').toString('base64');

      const body: any = {
        message: commitMessage,
        content: contentBase64,
        branch: defaultBranch,
      };

      // Include SHA only if file exists (for update)
      if (existingSha) {
        body.sha = existingSha;
      }

      const encodedPath = encodeURIComponent(file.path);
      const result = await this.request(
        `/repos/${owner}/${name}/contents/${encodedPath}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );

      console.log(
        `[GitHub] ${existingSha ? 'Updated' : 'Created'} file: ${file.path}`
      );

      return result;
    } catch (error: any) {
      console.error(`[GitHub] Error upserting file ${file.path}:`, error);
      throw new Error(`Failed to push file ${file.path}: ${error.message}`);
    }
  }

  /**
   * Push multiple files to repository
   * V1: Sequential push (simple but may hit rate limits with many files)
   * V2 (future): Use Git Data API with tree/commit for atomic multi-file push
   */
  async pushFiles(
    repo: GitHubRepoInfo,
    files: ProjectFileSnapshot[],
    commitMessage: string
  ): Promise<{ commitSha: string; fileCount: number }> {
    if (files.length === 0) {
      throw new Error('No files to push');
    }

    console.log(`[GitHub] Pushing ${files.length} files to ${repo.owner}/${repo.name}`);

    let lastCommitSha: string | undefined;

    // Push files sequentially
    // TODO: Add rate limit handling with exponential backoff
    for (const file of files) {
      const result = await this.upsertFile(repo, file, commitMessage);
      lastCommitSha = result.commit?.sha || result.content?.sha;

      // Small delay to avoid rate limiting (GitHub allows ~5000 requests/hour)
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (!lastCommitSha) {
      throw new Error('No commit SHA returned from GitHub');
    }

    console.log(
      `[GitHub] Successfully pushed ${files.length} files, commit: ${lastCommitSha}`
    );

    return {
      commitSha: lastCommitSha,
      fileCount: files.length,
    };
  }

  /**
   * Get commit URL for viewing on GitHub
   */
  getCommitUrl(owner: string, repo: string, commitSha: string): string {
    return `https://github.com/${owner}/${repo}/commit/${commitSha}`;
  }
}
