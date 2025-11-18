/**
 * Legal Report PDF Generator
 * Creates compliance reports for DSAR requests with HMAC signatures
 */

import * as admin from 'firebase-admin';
import { onCall, HttpsError } from "firebase-functions/v2/https";
import PDFDocument from 'pdfkit';
import * as crypto from 'crypto';
import { Readable } from 'stream';

const db = admin.firestore();
const storage = admin.storage();

export interface LegalReportPayload {
  dsarId: string;
  uid: string;
  type: 'export' | 'deletion';
  receivedAt: string;
  processedAt?: string;
  status: string;
  approvalTrail: string;
  requestData: Record<string, any>;
}

/**
 * Generate HMAC signature for report integrity
 */
function generateHMAC(data: any): string {
  const secret = process.env.REPORT_HMAC_SECRET || 'default_secret_change_me';
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(data))
    .digest('hex');
}

/**
 * Create PDF report document
 */
async function createPDFReport(payload: LegalReportPayload): Promise<Buffer> {
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

    const chunks: Buffer[] = [];

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
      .text(
        'This report contains confidential information. Unauthorized distribution is prohibited.',
        { align: 'center' }
      );

    // Finalize
    doc.end();
  });
}

/**
 * Upload PDF to Cloud Storage and get signed URL
 */
async function uploadPDFToStorage(
  dsarId: string,
  pdfBuffer: Buffer
): Promise<string> {
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
export const generateLegalReport = onCall(async (request) => {
  // Verify admin
  if (!request.auth?.token?.admin) {
    throw new HttpsError(
      'permission-denied',
      'Only admins can generate legal reports'
    );
  }

  const { dsarId } = request.data;

  if (!dsarId) {
    throw new HttpsError('invalid-argument', 'dsarId is required');
  }

  try {
    console.log(`📄 Generating legal report for DSAR ${dsarId}...`);

    // Get DSAR request
    const dsarDoc = await db.collection('dsar_requests').doc(dsarId).get();

    if (!dsarDoc.exists) {
      throw new HttpsError('not-found', 'DSAR request not found');
    }

    const dsarData = dsarDoc.data()!;

    // Build approval trail
    let approvalTrail = `Request submitted: ${dsarData.requestedAt?.toDate().toISOString()}\n`;

    if (dsarData.approvedBy) {
      approvalTrail += `Approved by: ${dsarData.approvedBy} at ${dsarData.approvedAt
        ?.toDate()
        .toISOString()}\n`;
    }

    if (dsarData.deniedBy) {
      approvalTrail += `Denied by: ${dsarData.deniedBy} at ${dsarData.deniedAt
        ?.toDate()
        .toISOString()}\n`;
      approvalTrail += `Denial reason: ${dsarData.denialReason}\n`;
    }

    if (dsarData.processedAt) {
      approvalTrail += `Processed: ${dsarData.processedAt?.toDate().toISOString()}\n`;
    }

    if (dsarData.metadata?.autoApproved) {
      approvalTrail += 'Auto-approved: Yes (system decision)\n';
    }

    // Build payload
    const payload: LegalReportPayload = {
      dsarId,
      uid: dsarData.uid,
      type: dsarData.type,
      receivedAt: dsarData.requestedAt?.toDate().toISOString() || new Date().toISOString(),
      processedAt: dsarData.processedAt?.toDate().toISOString(),
      status: dsarData.status,
      approvalTrail,
      requestData: {
        type: dsarData.type,
        status: dsarData.status,
        metadata: dsarData.metadata || {},
        exportUrl: dsarData.exportUrl || null,
        exportExpiresAt: dsarData.exportExpiresAt?.toDate().toISOString() || null,
      },
    };

    // Generate PDF
    const pdfBuffer = await createPDFReport(payload);

    // Upload to Storage
    const downloadUrl = await uploadPDFToStorage(dsarId, pdfBuffer);

    // Log audit
    await db.collection('audit_logs').add({
      ts: admin.firestore.FieldValue.serverTimestamp(),
      actor: request.auth.uid,
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
  } catch (error: any) {
    console.error(`❌ Failed to generate legal report for ${dsarId}:`, error.message);

    // Log error
    await db.collection('audit_logs').add({
      ts: admin.firestore.FieldValue.serverTimestamp(),
      actor: request.auth?.uid || 'unknown',
      action: 'legal_report.generate',
      resource: `dsar_requests/${dsarId}`,
      status: 'error',
      metadata: {
        dsarId,
        error: error.message,
      },
    });

    throw new HttpsError('internal', error.message);
  }
});
