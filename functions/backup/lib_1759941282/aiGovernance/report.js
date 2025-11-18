"use strict";
/**
 * AI Governance - PDF Report Generator
 * Creates compliance reports for AI evaluations with HMAC signatures
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
exports.createAIGovernanceReport = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const PDFDocument = __importStar(require("pdfkit"));
const crypto = __importStar(require("crypto"));
/**
 * Generate HMAC signature for report integrity
 */
function generateHMAC(data) {
    const secret = process.env.REPORT_HMAC_SECRET || 'default_secret_change_me';
    return crypto.createHmac('sha256', secret).update(JSON.stringify(data)).digest('hex');
}
/**
 * Aggregate AI evaluation data
 */
async function aggregateEvaluations(db, limit = 500) {
    const snaps = await db.collectionGroup('runs').orderBy('meta.ts', 'desc').limit(limit).get();
    const docs = snaps.docs.map((d) => d.data());
    const total = docs.length || 1;
    const sum = (key) => docs.reduce((acc, doc) => acc + ((doc === null || doc === void 0 ? void 0 : doc[key]) || 0), 0);
    const flagged = docs.filter((doc) => doc.flagged === true).length;
    const piiLeaks = docs.filter((doc) => doc.piiLeak === true).length;
    // Count by model
    const modelCounts = {};
    docs.forEach((doc) => {
        const model = doc.model || 'unknown';
        modelCounts[model] = (modelCounts[model] || 0) + 1;
    });
    const topModels = Object.entries(modelCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([model, count]) => ({ model, count }));
    return {
        total,
        avgQuality: sum('quality') / total,
        avgBias: sum('bias') / total,
        avgToxicity: sum('toxicity') / total,
        flagged,
        flagRate: (flagged / total) * 100,
        piiLeaks,
        topModels,
    };
}
/**
 * Create PDF report document
 */
async function createPDFReport(summary, signature) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4',
            info: {
                Title: 'AI Governance Report',
                Author: 'F0 AI Governance System',
                Subject: 'AI Evaluation Summary',
                Creator: 'F0 Compliance',
            },
        });
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        // Header
        doc
            .fontSize(24)
            .fillColor('#667eea')
            .text('F0', { align: 'center' })
            .moveDown(0.5);
        doc
            .fontSize(18)
            .fillColor('#000')
            .text('AI Governance Report', { align: 'center', underline: true })
            .moveDown(1.5);
        // Summary Statistics
        doc.fontSize(14).fillColor('#667eea').text('Evaluation Summary', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(11).fillColor('#000');
        doc.text(`Total Evaluations: ${summary.total}`);
        doc.text(`Average Quality Score: ${summary.avgQuality.toFixed(2)}/100`);
        doc.text(`Average Bias Score: ${summary.avgBias.toFixed(2)}/100`);
        doc.text(`Average Toxicity Score: ${summary.avgToxicity.toFixed(2)}/100`);
        doc.text(`Flagged Outputs: ${summary.flagged} (${summary.flagRate.toFixed(2)}%)`);
        doc.text(`PII Leaks Detected: ${summary.piiLeaks}`);
        doc.moveDown(1);
        // Top Models
        doc.fontSize(14).fillColor('#667eea').text('Top Models by Usage', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(11).fillColor('#000');
        summary.topModels.forEach((m, i) => {
            doc.text(`${i + 1}. ${m.model}: ${m.count} evaluations`);
        });
        doc.moveDown(1);
        // Risk Assessment
        doc.fontSize(14).fillColor('#667eea').text('Risk Assessment', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(11).fillColor('#000');
        const riskLevel = summary.flagRate > 10 ? 'HIGH' : summary.flagRate > 5 ? 'MEDIUM' : 'LOW';
        const riskColor = riskLevel === 'HIGH' ? '#ef4444' : riskLevel === 'MEDIUM' ? '#f59e0b' : '#22c55e';
        doc.fillColor(riskColor).text(`Overall Risk Level: ${riskLevel}`, { continued: false });
        doc.fillColor('#000');
        doc.moveDown(0.5);
        if (summary.flagRate > 10) {
            doc.text('⚠️  High flag rate detected. Immediate review recommended.');
        }
        else if (summary.flagRate > 5) {
            doc.text('⚠️  Moderate flag rate. Continue monitoring.');
        }
        else {
            doc.text('✅ Low flag rate. System performing within acceptable parameters.');
        }
        if (summary.piiLeaks > 0) {
            doc.moveDown(0.5);
            doc.fillColor('#ef4444').text(`⚠️  ${summary.piiLeaks} PII leak(s) detected! Review immediately.`);
            doc.fillColor('#000');
        }
        doc.moveDown(1.5);
        // Recommendations
        doc.fontSize(14).fillColor('#667eea').text('Recommendations', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#333');
        const recommendations = [];
        if (summary.avgQuality < 70) {
            recommendations.push('• Review prompts to improve output quality');
        }
        if (summary.avgBias > 20) {
            recommendations.push('• Implement bias mitigation strategies in prompts');
        }
        if (summary.avgToxicity > 15) {
            recommendations.push('• Add content filtering before user-facing outputs');
        }
        if (summary.piiLeaks > 0) {
            recommendations.push('• Enable PII detection and redaction in preprocessing');
        }
        if (summary.flagRate > 5) {
            recommendations.push('• Increase human review for flagged outputs');
        }
        if (recommendations.length === 0) {
            doc.text('✅ No critical recommendations at this time. Continue monitoring.');
        }
        else {
            recommendations.forEach((rec) => doc.text(rec));
        }
        doc.moveDown(1.5);
        // HMAC Signature
        doc.fontSize(14).fillColor('#667eea').text('Integrity Verification', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#000');
        doc.text('HMAC-SHA256 Signature:', { continued: false });
        doc.fontSize(9).fillColor('#666').font('Courier').text(signature);
        doc.moveDown(1);
        // Footer
        doc
            .fontSize(8)
            .fillColor('#999')
            .text('This document was generated automatically by the F0 AI Governance System.', {
            align: 'center',
        });
        doc.text(`Generated: ${new Date().toISOString()}`, { align: 'center' });
        doc.moveDown(0.5);
        doc
            .fontSize(7)
            .text('This report contains confidential information. Unauthorized distribution is prohibited.', {
            align: 'center',
        });
        doc.end();
    });
}
/**
 * Cloud Function (HTTPS Callable)
 * Generates AI Governance PDF report
 */
exports.createAIGovernanceReport = functions.https.onCall(async (payload, context) => {
    var _a, _b;
    // Verify admin
    if (!((_b = (_a = context.auth) === null || _a === void 0 ? void 0 : _a.token) === null || _b === void 0 ? void 0 : _b.admin)) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can generate AI governance reports');
    }
    try {
        console.log('📄 Generating AI Governance Report...');
        const db = admin.firestore();
        // Aggregate evaluation data
        const limit = (payload === null || payload === void 0 ? void 0 : payload.limit) || 500;
        const summary = await aggregateEvaluations(db, limit);
        // Generate HMAC signature
        const signature = generateHMAC(summary);
        // Create PDF
        const pdfBuffer = await createPDFReport(summary, signature);
        // Upload to Cloud Storage
        const bucket = admin.storage().bucket();
        const fileName = `reports/ai-governance-${Date.now()}.pdf`;
        const file = bucket.file(fileName);
        await file.save(pdfBuffer, {
            contentType: 'application/pdf',
            metadata: {
                cacheControl: 'private, max-age=0',
            },
        });
        // Generate signed URL (valid for 7 days)
        const [signedUrl] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        });
        // Log to audit
        await db.collection('audit_logs').add({
            ts: admin.firestore.FieldValue.serverTimestamp(),
            actor: context.auth.uid,
            action: 'ai_governance.report.generate',
            resource: `reports/${fileName}`,
            status: 'success',
            metadata: {
                reportSize: pdfBuffer.length,
                evaluationsIncluded: summary.total,
                flagRate: summary.flagRate,
            },
        });
        console.log(`✅ AI Governance Report generated: ${fileName}`);
        return {
            signedUrl,
            summary,
            signature,
            size: pdfBuffer.length,
        };
    }
    catch (error) {
        console.error('❌ Error generating AI Governance Report:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
//# sourceMappingURL=report.js.map