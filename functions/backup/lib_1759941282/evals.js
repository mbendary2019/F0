"use strict";
/**
 * Scheduled Evaluation Cloud Functions
 * Nightly evals, hourly red-team, and drift detection
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.driftDetector = exports.hourlyRedTeam = exports.nightlyEvals = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const db = admin.firestore();
/**
 * Get date key in YYYYMMDD format
 */
function getDateKey() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}
/**
 * List active experiments
 */
async function listActiveExperiments() {
    const snap = await db
        .collection('eval_experiments')
        .where('active', '==', true)
        .get();
    const experiments = [];
    snap.forEach((doc) => {
        experiments.push(Object.assign({ id: doc.id }, doc.data()));
    });
    return experiments;
}
/**
 * Enqueue an evaluation run
 */
async function enqueueRun(params) {
    const { expId, model, promptId, sampleSize } = params;
    const runRef = await db.collection('eval_runs').add({
        expId,
        model,
        promptId,
        sampleSize,
        status: 'queued',
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`[enqueueRun] Created run ${runRef.id} for experiment ${expId}`);
    return runRef.id;
}
/**
 * Nightly Evaluations
 * Runs all active experiments once per day
 */
exports.nightlyEvals = functions.pubsub
    .schedule('every 24 hours')
    .timeZone('UTC')
    .onRun(async (context) => {
    console.log('[nightlyEvals] Starting nightly evaluation runs');
    try {
        const experiments = await listActiveExperiments();
        if (experiments.length === 0) {
            console.log('[nightlyEvals] No active experiments found');
            return null;
        }
        console.log(`[nightlyEvals] Found ${experiments.length} active experiments`);
        const runIds = [];
        for (const exp of experiments) {
            const defaultModel = exp.defaultModel || 'gpt-4o-mini';
            const defaultPromptId = exp.defaultPromptId || 'default';
            const defaultSampleSize = exp.defaultSampleSize || Number(process.env.EVALS_SAMPLE_SIZE || 100);
            const runId = await enqueueRun({
                expId: exp.id,
                model: defaultModel,
                promptId: defaultPromptId,
                sampleSize: defaultSampleSize,
            });
            runIds.push(runId);
        }
        console.log(`[nightlyEvals] Enqueued ${runIds.length} evaluation runs`);
        return null;
    }
    catch (error) {
        console.error('[nightlyEvals] Error:', error);
        throw error;
    }
});
/**
 * Hourly Red Team Audits
 * Tests critical prompts against adversarial attacks
 */
exports.hourlyRedTeam = functions.pubsub
    .schedule(`every ${process.env.REDTEAM_INTERVAL_MINUTES || 60} minutes`)
    .timeZone('UTC')
    .onRun(async (context) => {
    console.log('[hourlyRedTeam] Starting red team audits');
    try {
        // Get prompts marked for red team testing
        const snap = await db
            .collection('prompt_targets')
            .where('redteam', '==', true)
            .get();
        if (snap.empty) {
            console.log('[hourlyRedTeam] No prompts marked for red team testing');
            return null;
        }
        console.log(`[hourlyRedTeam] Found ${snap.size} prompts to audit`);
        const queued = [];
        for (const doc of snap.docs) {
            const data = doc.data();
            const model = data.model || 'gpt-4o-mini';
            // Add to audit queue
            const queueRef = await db.collection('prompt_audit_queue').add({
                promptId: doc.id,
                model,
                enqueuedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            queued.push(queueRef.id);
        }
        console.log(`[hourlyRedTeam] Queued ${queued.length} audits`);
        return null;
    }
    catch (error) {
        console.error('[hourlyRedTeam] Error:', error);
        throw error;
    }
});
/**
 * Drift Detector
 * Monitors model performance degradation
 */
exports.driftDetector = functions.pubsub
    .schedule('every 60 minutes')
    .timeZone('UTC')
    .onRun(async (context) => {
    console.log('[driftDetector] Starting drift detection');
    try {
        const dateKey = getDateKey();
        // Trigger drift check by creating a marker document
        // The actual drift detection logic runs server-side via scheduled task or API call
        await db.collection('drift_checks').add({
            dateKey,
            ts: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log('[driftDetector] Created drift check marker');
        // Optional: Run drift detection inline (can be resource-intensive)
        // Alternatively, trigger via HTTP function or separate worker
        /*
        const { checkAllModelsDrift } = require('./drift'); // Would need to import server utils
        const result = await checkAllModelsDrift();
        console.log(`[driftDetector] Checked ${result.models_checked} models, found ${result.drift_detected.length} drifting metrics`);
        */
        return null;
    }
    catch (error) {
        console.error('[driftDetector] Error:', error);
        throw error;
    }
});
//# sourceMappingURL=evals.js.map