/**
 * AI Evaluations System
 * Run experiments, collect metrics, and track model performance
 */

import { db } from './firebase-admin';
import { judgeLLM, calculateRougeL, type Rubric, DEFAULT_RUBRICS } from './judge';
import { timeIt } from './obs';
import { alert } from './alerts';

export interface EvalSample {
  id?: string;
  input: any; // Can be string or structured data
  expected?: any;
  metadata?: Record<string, any>;
}

export interface EvalDataset {
  name: string;
  description?: string;
  samples: EvalSample[];
}

export interface EvalExperiment {
  id?: string;
  name: string;
  description?: string;
  datasetRef?: string; // Reference to stored dataset
  rubric: Rubric;
  createdBy: string;
  createdAt: Date;
  active: boolean;
}

export interface EvalRun {
  id?: string;
  expId: string;
  model: string;
  promptId?: string;
  sampleSize: number;
  startedAt: Date;
  finishedAt?: Date;
  status: 'queued' | 'running' | 'completed' | 'failed';
  metrics?: {
    accuracy?: number;
    pass_rate?: number;
    rouge_l?: number;
    avg_latency_ms?: number;
    p95_latency_ms?: number;
    total_tokens?: number;
    cost_est?: number;
  };
  error?: string;
}

export interface EvalResult {
  id?: string;
  runId: string;
  sampleId: string;
  input: any;
  expected?: any;
  output: string;
  score: number;
  passed: boolean;
  judge_votes?: number;
  rubric_breakdown?: Record<string, number>;
  latency_ms: number;
  tokens?: number;
  error?: string;
}

/**
 * Create a new experiment
 */
export async function createExperiment(experiment: Omit<EvalExperiment, 'id'>): Promise<string> {
  const ref = await db.collection('eval_experiments').add({
    name: experiment.name,
    description: experiment.description || '',
    datasetRef: experiment.datasetRef || null,
    rubric: experiment.rubric,
    createdBy: experiment.createdBy,
    createdAt: experiment.createdAt,
    active: experiment.active,
  });

  return ref.id;
}

/**
 * Load experiment by ID
 */
export async function loadExperiment(expId: string): Promise<EvalExperiment | null> {
  const doc = await db.collection('eval_experiments').doc(expId).get();

  if (!doc.exists) {
    return null;
  }

  const data = doc.data()!;
  return {
    id: doc.id,
    name: data.name,
    description: data.description,
    datasetRef: data.datasetRef,
    rubric: data.rubric,
    createdBy: data.createdBy,
    createdAt: data.createdAt.toDate(),
    active: data.active,
  };
}

/**
 * Load rubric for experiment (or use default)
 */
export async function loadRubric(expId: string): Promise<Rubric> {
  const experiment = await loadExperiment(expId);

  if (experiment && experiment.rubric) {
    return experiment.rubric;
  }

  // Return default rubric
  return DEFAULT_RUBRICS.correctness;
}

/**
 * Generate model output (placeholder for LLM provider integration)
 * TODO: Replace with actual LLM provider call
 */
async function generateModelOutput(params: {
  model: string;
  promptId?: string;
  input: any;
}): Promise<{ output: string; tokens: number; latency_ms: number }> {
  const { model, promptId, input } = params;

  // Placeholder implementation
  // In production, integrate with your LLM provider from Sprint 4

  const t0 = Date.now();

  // Mock LLM call
  await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate latency

  const output = `Generated output for model ${model} with input: ${JSON.stringify(input).slice(0, 50)}...`;
  const tokens = output.split(' ').length;
  const latency_ms = Date.now() - t0;

  return { output, tokens, latency_ms };
}

/**
 * Run evaluation on a dataset
 */
export async function runEval(params: {
  expId: string;
  model: string;
  promptId?: string;
  dataset: EvalSample[];
}): Promise<{ runId: string; metrics: EvalRun['metrics'] }> {
  const { expId, model, promptId, dataset } = params;

  console.log(`[runEval] Starting evaluation for experiment ${expId}`);

  // Create run record
  const runRef = await db.collection('eval_runs').add({
    expId,
    model,
    promptId: promptId || null,
    sampleSize: dataset.length,
    status: 'running',
    startedAt: new Date(),
  });

  const runId = runRef.id;

  try {
    // Load rubric
    const rubric = await loadRubric(expId);

    // Process each sample
    const results: EvalResult[] = [];
    let passedCount = 0;
    let totalLatency = 0;
    const latencies: number[] = [];
    let totalTokens = 0;
    const rougeScores: number[] = [];

    for (const sample of dataset) {
      try {
        // Generate output
        const generation = await timeIt(`generate-${sample.id}`, async () => {
          return await generateModelOutput({
            model,
            promptId,
            input: sample.input,
          });
        });

        const { output, tokens, latency_ms } = generation;

        totalLatency += latency_ms;
        latencies.push(latency_ms);
        totalTokens += tokens;

        // Judge output
        const verdict = await judgeLLM({
          input: typeof sample.input === 'string' ? sample.input : JSON.stringify(sample.input),
          output,
          expected: sample.expected,
          rubric,
        });

        if (verdict.pass) {
          passedCount++;
        }

        // Calculate ROUGE-L if expected output available
        let rougeL = 0;
        if (sample.expected) {
          rougeL = calculateRougeL(output, sample.expected);
          rougeScores.push(rougeL);
        }

        // Store result
        const result: EvalResult = {
          runId,
          sampleId: sample.id || `sample-${results.length}`,
          input: sample.input,
          expected: sample.expected,
          output,
          score: verdict.score,
          passed: verdict.pass,
          judge_votes: verdict.votes,
          rubric_breakdown: verdict.criteria,
          latency_ms,
          tokens,
        };

        results.push(result);

        // Write result to Firestore
        await db.collection(`eval_results`).add({
          ...result,
          runId,
        });

      } catch (error: any) {
        console.error(`[runEval] Error processing sample ${sample.id}:`, error);

        // Store error result
        await db.collection(`eval_results`).add({
          runId,
          sampleId: sample.id || `sample-${results.length}`,
          input: sample.input,
          expected: sample.expected,
          output: '',
          score: 0,
          passed: false,
          latency_ms: 0,
          error: error.message,
        });
      }
    }

    // Calculate metrics
    const accuracy = dataset.length > 0 ? passedCount / dataset.length : 0;
    const avg_latency_ms = dataset.length > 0 ? totalLatency / dataset.length : 0;

    // Calculate p95 latency
    latencies.sort((a, b) => a - b);
    const p95_index = Math.floor(latencies.length * 0.95);
    const p95_latency_ms = latencies[p95_index] || 0;

    // Calculate average ROUGE-L
    const rouge_l = rougeScores.length > 0
      ? rougeScores.reduce((sum, s) => sum + s, 0) / rougeScores.length
      : 0;

    const metrics: EvalRun['metrics'] = {
      accuracy,
      pass_rate: accuracy,
      rouge_l,
      avg_latency_ms,
      p95_latency_ms,
      total_tokens: totalTokens,
      cost_est: estimateCost(model, totalTokens),
    };

    // Update run with results
    await runRef.update({
      status: 'completed',
      finishedAt: new Date(),
      metrics,
    });

    console.log(`[runEval] Completed: ${runId}, Accuracy: ${(accuracy * 100).toFixed(1)}%`);

    return { runId, metrics };

  } catch (error: any) {
    console.error(`[runEval] Failed:`, error);

    // Update run with error
    await runRef.update({
      status: 'failed',
      finishedAt: new Date(),
      error: error.message,
    });

    // Create alert for failed eval
    await alert({
      severity: 'warning',
      kind: 'function_error',
      message: `Evaluation run failed: ${error.message}`,
      context: {
        runId,
        expId,
        model,
        error: error.message,
      },
    });

    throw error;
  }
}

/**
 * Estimate cost based on token usage
 * TODO: Update with actual pricing for your models
 */
function estimateCost(model: string, tokens: number): number {
  // Placeholder pricing (per 1M tokens)
  const pricing: Record<string, number> = {
    'gpt-4o': 5.0,
    'gpt-4o-mini': 0.15,
    'gpt-3.5-turbo': 0.5,
    'claude-3-5-sonnet': 3.0,
  };

  const pricePerMillion = pricing[model] || 1.0;
  return (tokens / 1_000_000) * pricePerMillion;
}

/**
 * Get recent runs for an experiment
 */
export async function getRecentRuns(expId: string, limit: number = 10): Promise<EvalRun[]> {
  const snapshot = await db
    .collection('eval_runs')
    .where('expId', '==', expId)
    .orderBy('startedAt', 'desc')
    .limit(limit)
    .get();

  const runs: EvalRun[] = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    runs.push({
      id: doc.id,
      expId: data.expId,
      model: data.model,
      promptId: data.promptId,
      sampleSize: data.sampleSize,
      startedAt: data.startedAt.toDate(),
      finishedAt: data.finishedAt?.toDate(),
      status: data.status,
      metrics: data.metrics,
      error: data.error,
    });
  });

  return runs;
}

/**
 * Get results for a run
 */
export async function getRunResults(runId: string, limit: number = 100): Promise<EvalResult[]> {
  const snapshot = await db
    .collection('eval_results')
    .where('runId', '==', runId)
    .limit(limit)
    .get();

  const results: EvalResult[] = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    results.push({
      id: doc.id,
      runId: data.runId,
      sampleId: data.sampleId,
      input: data.input,
      expected: data.expected,
      output: data.output,
      score: data.score,
      passed: data.passed,
      judge_votes: data.judge_votes,
      rubric_breakdown: data.rubric_breakdown,
      latency_ms: data.latency_ms,
      tokens: data.tokens,
      error: data.error,
    });
  });

  return results;
}
