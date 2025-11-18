"use strict";
/**
 * Legal Report PDF Generator
 * Creates compliance reports for DSAR requests with HMAC signatures
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
exports.generateLegalReport = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const PDFDocument = __importStar(require("pdfkit"));
const crypto = __importStar(require("crypto"));
const db = admin.firestore();
const storage = admin.storage();
/**
 * Generate HMAC signature for report integrity
 */
function generateHMAC(data) {
    const secret = process.env.REPORT_HMAC_SECRET || 'default_secret_change_me';
    return crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(data))
        .digest('hex');
}
/**
 * Create PDF report document
 */
async function createPDFReport(payload) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4',
            info: {
                Title: 'Legal DSAR Report',
                Author: 'F0 Compliance System',
                Subject: `DSAR ${payload.dsarId}`,
                Creator: 'F0 Compliance',
            },
        });
        const chunks = [];
        // Collect PDF data
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
            .text('Legal DSAR Compliance Report', { align: 'center', underline: true })
            .moveDown(1.5);
        // Request Details
        doc.fontSize(14).fillColor('#667eea').text('Request Details', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(11).fillColor('#000');
        doc.text(`DSAR ID: ${payload.dsarId}`);
        doc.text(`User UID: ${payload.uid}`);
        doc.text(`Request Type: ${payload.type.toUpperCase()}`);
        doc.text(`Received: ${new Date(payload.receivedAt).toISOString()}`);
        if (payload.processedAt) {
            doc.text(`Processed: ${new Date(payload.processedAt).toISOString()}`);
        }
        doc.text(`Status: ${payload.status.toUpperCase()}`);
        doc.moveDown(1);
        // Approval Trail
        doc.fontSize(14).fillColor('#667eea').text('Approval Trail', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(11).fillColor('#000').text(payload.approvalTrail);
        doc.moveDown(1);
        // Request Data
        doc.fontSize(14).fillColor('#667eea').text('Request Data', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#333');
        doc.text(JSON.stringify(payload.requestData, null, 2), {
            width: 500,
        });
        doc.moveDown(1.5);
        // HMAC Signature
        const hmac = generateHMAC(payload);
        doc.fontSize(14).fillColor('#667eea').text('Integrity Verification', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#000');
        doc.text('HMAC-SHA256 Signature:', { continued: false });
        doc.fontSize(9).fillColor('#666').font('Courier').text(hmac);
        doc.moveDown(1);
        // Footer
        doc
            .fontSize(8)
            .fillColor('#999')
            .text('This document was generated automatically by the F0 Compliance System.', {
            align: 'center',
        });
        doc.text(`Generated: ${new Date().toISOString()}`, { align: 'center' });
        doc.moveDown(0.5);
        doc
            .fontSize(7)
            .text('This report contains confidential information. Unauthorized distribution is prohibited.', { align: 'center' });
        // Finalize
        doc.end();
    });
}
/**
 * Upload PDF to Cloud Storage and get signed URL
 */
async function uploadPDFToStorage(dsarId, pdfBuffer) {
    const bucketName = process.env.EXPORT_STORAGE_BUCKET || 'f0-exports';
    const bucket = storage.bucket(bucketName);
    const fileName = `legal-reports/${dsarId}/report-${Date.now()}.pdf`;
    const file = bucket.file(fileName);
    // Upload
    await file.save(pdfBuffer, {
        contentType: 'application/pdf',
        metadata: {
            cacheControl: 'private, max-age=0',
        },
    });
    // Generate signed URL (valid for 7 days)
    const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    return signedUrl;
}
/**
 * HTTP Callable: Generate legal report for DSAR request
 */
exports.generateLegalReport = functions.https.onCall(async (data, context) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    // Verify admin
    if (!((_b = (_a = context.auth) === null || _a === void 0 ? void 0 : _a.token) === null || _b === void 0 ? void 0 : _b.admin)) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can generate legal reports');
    }
    const { dsarId } = data;
    if (!dsarId) {
        throw new functions.https.HttpsError('invalid-argument', 'dsarId is required');
    }
    try {
        console.log(`📄 Generating legal report for DSAR ${dsarId}...`);
        // Get DSAR request
        const dsarDoc = await db.collection('dsar_requests').doc(dsarId).get();
        if (!dsarDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'DSAR request not found');
        }
        const dsarData = dsarDoc.data();
        // Build approval trail
        let approvalTrail = `Request submitted: ${(_c = dsarData.requestedAt) === null || _c === void 0 ? void 0 : _c.toDate().toISOString()}\n`;
        if (dsarData.approvedBy) {
            approvalTrail += `Approved by: ${dsarData.approvedBy} at ${(_d = dsarData.approvedAt) === null || _d === void 0 ? void 0 : _d.toDate().toISOString()}\n`;
        }
        if (dsarData.deniedBy) {
            approvalTrail += `Denied by: ${dsarData.deniedBy} at ${(_e = dsarData.deniedAt) === null || _e === void 0 ? void 0 : _e.toDate().toISOString()}\n`;
            approvalTrail += `Denial reason: ${dsarData.denialReason}\n`;
        }
        if (dsarData.processedAt) {
            approvalTrail += `Processed: ${(_f = dsarData.processedAt) === null || _f === void 0 ? void 0 : _f.toDate().toISOString()}\n`;
        }
        if ((_g = dsarData.metadata) === null || _g === void 0 ? void 0 : _g.autoApproved) {
            approvalTrail += 'Auto-approved: Yes (system decision)\n';
        }
        // Build payload
        const payload = {
            dsarId,
            uid: dsarData.uid,
            type: dsarData.type,
            receivedAt: ((_h = dsarData.requestedAt) === null || _h === void 0 ? void 0 : _h.toDate().toISOString()) || new Date().toISOString(),
            processedAt: (_j = dsarData.processedAt) === null || _j === void 0 ? void 0 : _j.toDate().toISOString(),
            status: dsarData.status,
            approvalTrail,
            requestData: {
                type: dsarData.type,
                status: dsarData.status,
                metadata: dsarData.metadata || {},
                exportUrl: dsarData.exportUrl || null,
                exportExpiresAt: ((_k = dsarData.exportExpiresAt) === null || _k === void 0 ? void 0 : _k.toDate().toISOString()) || null,
            },
        };
        // Generate PDF
        const pdfBuffer = await createPDFReport(payload);
        // Upload to Storage
        const downloadUrl = await uploadPDFToStorage(dsarId, pdfBuffer);
        // Log audit
        await db.collection('audit_logs').add({
            ts: admin.firestore.FieldValue.serverTimestamp(),
            actor: context.auth.uid,
            action: 'legal_report.generate',
            resource: `dsar_requests/${dsarId}`,
            status: 'success',
            metadata: {
                dsarId,
                reportSize: pdfBuffer.length,
                downloadUrl,
            },
        });
        console.log(`✅ Legal report generated for ${dsarId}`);
        return {
            success: true,
            downloadUrl,
            size: pdfBuffer.length,
            hmac: generateHMAC(payload),
        };
    }
    catch (error) {
        console.error(`❌ Failed to generate legal report for ${dsarId}:`, error.message);
        // Log error
        await db.collection('audit_logs').add({
            ts: admin.firestore.FieldValue.serverTimestamp(),
            actor: ((_l = context.auth) === null || _l === void 0 ? void 0 : _l.uid) || 'unknown',
            action: 'legal_report.generate',
            resource: `dsar_requests/${dsarId}`,
            status: 'error',
            metadata: {
                dsarId,
                error: error.message,
            },
        });
        throw new functions.https.HttpsError('internal', error.message);
    }
});
//# sourceMappingURL=legalReport.js.map