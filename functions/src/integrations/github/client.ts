// functions/src/integrations/github/client.ts
import { Octokit } from '@octokit/rest';
import * as logger from 'firebase-functions/logger';

export interface GitHubConfig {
  owner: string;
  repo: string;
  token: string;
}

export class GitHubClient {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(config: GitHubConfig) {
    this.owner = config.owner;
    this.repo = config.repo;
    this.octokit = new Octokit({
      auth: config.token,
      userAgent: 'F0-Platform/1.0',
    });
  }

  /**
   * Get repository information
   */
  async getRepo() {
    try {
      const { data } = await this.octokit.repos.get({
        owner: this.owner,
        repo: this.repo,
      });
      return data;
    } catch (error: any) {
      logger.error('[GitHubClient] getRepo error:', error);
      throw new Error(`Failed to get repo: ${error.message}`);
    }
  }

  /**
   * Get default branch
   */
  async getDefaultBranch(): Promise<string> {
    const repo = await this.getRepo();
    return repo.default_branch;
  }

  /**
   * Get latest commit on a branch
   */
  async getLatestCommit(branch: string) {
    try {
      const { data } = await this.octokit.repos.getCommit({
        owner: this.owner,
        repo: this.repo,
        ref: branch,
      });
      return {
        sha: data.sha,
        message: data.commit.message,
        author: data.commit.author?.name || 'Unknown',
        date: data.commit.author?.date || new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('[GitHubClient] getLatestCommit error:', error);
      throw new Error(`Failed to get latest commit: ${error.message}`);
    }
  }

  /**
   * Create or update a file
   */
  async createOrUpdateFile(params: {
    path: string;
    content: string;
    message: string;
    branch: string;
    sha?: string;
  }) {
    try {
      const { data } = await this.octokit.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path: params.path,
        message: params.message,
        content: Buffer.from(params.content).toString('base64'),
        branch: params.branch,
        sha: params.sha,
      });
      return data;
    } catch (error: any) {
      logger.error('[GitHubClient] createOrUpdateFile error:', error);
      throw new Error(`Failed to create/update file: ${error.message}`);
    }
  }

  /**
   * Get file content from repository
   */
  async getFileContent(path: string, branch?: string) {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref: branch,
      });

      if (Array.isArray(data) || data.type !== 'file') {
        throw new Error('Path is not a file');
      }

      return {
        content: Buffer.from(data.content, 'base64').toString('utf-8'),
        sha: data.sha,
      };
    } catch (error: any) {
      if (error.status === 404) {
        return null; // File doesn't exist
      }
      logger.error('[GitHubClient] getFileContent error:', error);
      throw new Error(`Failed to get file content: ${error.message}`);
    }
  }

  /**
   * Create a new branch
   */
  async createBranch(newBranch: string, fromBranch: string) {
    try {
      // Get the SHA of the commit we want to branch from
      const { data: refData } = await this.octokit.git.getRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${fromBranch}`,
      });

      // Create the new branch
      const { data } = await this.octokit.git.createRef({
        owner: this.owner,
        repo: this.repo,
        ref: `refs/heads/${newBranch}`,
        sha: refData.object.sha,
      });

      return {
        branch: newBranch,
        sha: data.object.sha,
      };
    } catch (error: any) {
      logger.error('[GitHubClient] createBranch error:', error);
      throw new Error(`Failed to create branch: ${error.message}`);
    }
  }

  /**
   * List branches
   */
  async listBranches() {
    try {
      const { data } = await this.octokit.repos.listBranches({
        owner: this.owner,
        repo: this.repo,
      });
      return data.map((branch) => ({
        name: branch.name,
        protected: branch.protected,
      }));
    } catch (error: any) {
      logger.error('[GitHubClient] listBranches error:', error);
      throw new Error(`Failed to list branches: ${error.message}`);
    }
  }

  /**
   * Trigger workflow dispatch
   */
  async triggerWorkflow(workflowId: string, inputs: Record<string, any> = {}) {
    try {
      await this.octokit.actions.createWorkflowDispatch({
        owner: this.owner,
        repo: this.repo,
        workflow_id: workflowId,
        ref: 'main', // Can be parameterized
        inputs,
      });
      return { success: true };
    } catch (error: any) {
      logger.error('[GitHubClient] triggerWorkflow error:', error);
      throw new Error(`Failed to trigger workflow: ${error.message}`);
    }
  }

  /**
   * Get workflow runs
   */
  async getWorkflowRuns(workflowId?: string) {
    try {
      const params: any = {
        owner: this.owner,
        repo: this.repo,
      };

      if (workflowId) {
        params.workflow_id = workflowId;
      }

      const { data } = await this.octokit.actions.listWorkflowRunsForRepo(params);

      return data.workflow_runs.map((run) => ({
        id: run.id,
        name: run.name,
        status: run.status,
        conclusion: run.conclusion,
        createdAt: run.created_at,
        updatedAt: run.updated_at,
        htmlUrl: run.html_url,
      }));
    } catch (error: any) {
      logger.error('[GitHubClient] getWorkflowRuns error:', error);
      throw new Error(`Failed to get workflow runs: ${error.message}`);
    }
  }

  /**
   * Create a tree (for multi-file commits)
   */
  async createTree(files: Array<{ path: string; content: string; mode?: string }>, baseTreeSha?: string) {
    try {
      const tree = files.map((file) => ({
        path: file.path,
        mode: (file.mode || '100644') as '100644' | '100755' | '040000' | '160000' | '120000',
        type: 'blob' as const,
        content: file.content,
      }));

      const { data } = await this.octokit.git.createTree({
        owner: this.owner,
        repo: this.repo,
        tree,
        base_tree: baseTreeSha,
      });

      return data;
    } catch (error: any) {
      logger.error('[GitHubClient] createTree error:', error);
      throw new Error(`Failed to create tree: ${error.message}`);
    }
  }

  /**
   * Create a commit
   */
  async createCommit(message: string, treeSha: string, parentSha: string) {
    try {
      const { data } = await this.octokit.git.createCommit({
        owner: this.owner,
        repo: this.repo,
        message,
        tree: treeSha,
        parents: [parentSha],
      });

      return data;
    } catch (error: any) {
      logger.error('[GitHubClient] createCommit error:', error);
      throw new Error(`Failed to create commit: ${error.message}`);
    }
  }

  /**
   * Update branch reference
   */
  async updateRef(branch: string, sha: string) {
    try {
      const { data } = await this.octokit.git.updateRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${branch}`,
        sha,
      });

      return data;
    } catch (error: any) {
      logger.error('[GitHubClient] updateRef error:', error);
      throw new Error(`Failed to update ref: ${error.message}`);
    }
  }

  /**
   * Push multiple files in a single commit
   * Handles both empty and non-empty repositories
   */
  async pushFiles(params: {
    branch: string;
    message: string;
    files: Array<{ path: string; content: string }>;
  }) {
    try {
      let baseTreeSha: string | undefined;
      let parentSha: string | undefined;
      let isInitialCommit = false;

      // حاول تجيب آخر commit — لو الريبو فاضي هنعمل path خاص
      try {
        const latestCommit = await this.getLatestCommit(params.branch);

        // Get the tree of the latest commit
        const { data: commitData } = await this.octokit.git.getCommit({
          owner: this.owner,
          repo: this.repo,
          commit_sha: latestCommit.sha,
        });

        baseTreeSha = commitData.tree.sha;
        parentSha = latestCommit.sha;
      } catch (err: any) {
        // الحالة دي بتحصل لما الريبو فاضي تمامًا
        if (
          err?.status === 409 ||
          (typeof err?.message === "string" &&
            err.message.includes("Git Repository is empty"))
        ) {
          isInitialCommit = true;
        } else {
          throw err;
        }
      }

      // Create new tree with the files
      const tree = await this.createTree(params.files, baseTreeSha);

      // Create commit
      const commit = await this.octokit.git.createCommit({
        owner: this.owner,
        repo: this.repo,
        message: params.message,
        tree: tree.sha,
        parents: isInitialCommit || !parentSha ? [] : [parentSha],
      });

      // لو ده أول commit → أنشئ الـ branch من الصفر
      if (isInitialCommit) {
        await this.octokit.git.createRef({
          owner: this.owner,
          repo: this.repo,
          ref: `refs/heads/${params.branch}`,
          sha: commit.data.sha,
        });
      } else {
        await this.updateRef(params.branch, commit.data.sha);
      }

      return {
        sha: commit.data.sha,
        message: commit.data.message,
        url: commit.data.html_url,
      };
    } catch (error: any) {
      logger.error("[GitHubClient] pushFiles error:", error);
      throw new Error(`Failed to push files: ${error.message}`);
    }
  }
}

/**
 * Parse GitHub repo URL to extract owner and repo name
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    // Support formats:
    // - https://github.com/owner/repo
    // - https://github.com/owner/repo.git
    // - git@github.com:owner/repo.git

    const httpsMatch = url.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
    if (httpsMatch) {
      return {
        owner: httpsMatch[1],
        repo: httpsMatch[2],
      };
    }

    const sshMatch = url.match(/github\.com:([^\/]+)\/([^\/\.]+)/);
    if (sshMatch) {
      return {
        owner: sshMatch[1],
        repo: sshMatch[2],
      };
    }

    return null;
  } catch (error) {
    logger.error('[parseGitHubUrl] error:', error);
    return null;
  }
}
