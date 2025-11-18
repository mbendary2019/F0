"use strict";
/**
 * Notifications System
 * Email + In-App notifications for compliance events
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
exports.sendNotification = sendNotification;
exports.getUserEmail = getUserEmail;
exports.notifyDsarRequest = notifyDsarRequest;
exports.notifyDsarApproved = notifyDsarApproved;
exports.notifyDataExportReady = notifyDataExportReady;
exports.notifyAccountDeleted = notifyAccountDeleted;
const admin = __importStar(require("firebase-admin"));
const nodemailer = __importStar(require("nodemailer"));
const Handlebars = __importStar(require("handlebars"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const db = admin.firestore();
/**
 * Create nodemailer transporter
 */
function createMailer() {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: false, // Use STARTTLS
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
}
/**
 * Get email subject by notification type
 */
function getSubjectFromType(type) {
    const subjects = {
        dsar_request: 'We received your data request',
        dsar_approved: 'Your request was approved',
        dsar_denied: 'Your request was denied',
        data_export_ready: 'Your data export is ready',
        account_deleted: 'Your account has been deleted',
    };
    return subjects[type];
}
/**
 * Render email template
 */
function renderTemplate(type, data) {
    const templatePath = path.join(__dirname, '..', 'templates', `${type}.hbs`);
    if (!fs.existsSync(templatePath)) {
        console.warn(`Template not found: ${templatePath}, using fallback`);
        return `<html><body><h1>${getSubjectFromType(type)}</h1><pre>${JSON.stringify(data, null, 2)}</pre></body></html>`;
    }
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = Handlebars.compile(templateSource);
    return template(data);
}
/**
 * Send in-app notification
 */
async function sendInAppNotification(uid, type, meta) {
    try {
        await db
            .collection('notifications')
            .doc(uid)
            .collection('items')
            .add({
            type,
            meta,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false,
        });
        console.log(`✅ In-app notification sent to ${uid}: ${type}`);
    }
    catch (error) {
        console.error(`❌ Failed to send in-app notification to ${uid}:`, error.message);
        throw error;
    }
}
/**
 * Send email notification
 */
async function sendEmailNotification(email, type, meta) {
    try {
        // Check if SMTP is configured
        if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
            console.warn('⚠️  SMTP not configured, skipping email notification');
            return;
        }
        const html = renderTemplate(type, meta);
        const subject = getSubjectFromType(type);
        const transporter = createMailer();
        await transporter.sendMail({
            from: `"${process.env.MAIL_FROM_NAME || 'F0 Compliance'}" <${process.env.MAIL_FROM_EMAIL || 'noreply@example.com'}>`,
            to: email,
            subject,
            html,
        });
        console.log(`✅ Email sent to ${email}: ${type}`);
    }
    catch (error) {
        console.error(`❌ Failed to send email to ${email}:`, error.message);
        // Don't throw - email failures shouldn't break the flow
    }
}
/**
 * Send notification via specified channels
 */
async function sendNotification(params) {
    const { uid, type, channels, meta = {}, email } = params;
    console.log(`📬 Sending notification to ${uid}: ${type} via [${channels.join(', ')}]`);
    const promises = [];
    // In-app notification
    if (channels.includes('inApp')) {
        promises.push(sendInAppNotification(uid, type, meta));
    }
    // Email notification
    if (channels.includes('email') && email) {
        promises.push(sendEmailNotification(email, type, meta));
    }
    await Promise.allSettled(promises);
}
/**
 * Get user's email for notifications
 */
async function getUserEmail(uid) {
    try {
        const userRecord = await admin.auth().getUser(uid);
        return userRecord.email || null;
    }
    catch (error) {
        console.error(`Failed to get email for user ${uid}:`, error.message);
        return null;
    }
}
/**
 * Helper: Send DSAR request notification
 */
async function notifyDsarRequest(params) {
    const email = await getUserEmail(params.uid);
    await sendNotification({
        uid: params.uid,
        type: 'dsar_request',
        channels: ['email', 'inApp'],
        email: email || undefined,
        meta: {
            requestId: params.requestId,
            type: params.type,
            status: params.status,
            autoApproved: params.autoApproved || false,
            isExport: params.type === 'export',
            isDeletion: params.type === 'deletion',
            submittedAt: new Date().toISOString(),
        },
    });
}
/**
 * Helper: Send DSAR approved notification
 */
async function notifyDsarApproved(params) {
    var _a;
    const email = await getUserEmail(params.uid);
    await sendNotification({
        uid: params.uid,
        type: 'dsar_approved',
        channels: ['email', 'inApp'],
        email: email || undefined,
        meta: {
            requestId: params.requestId,
            type: params.type,
            approvedAt: new Date().toISOString(),
            approvedBy: params.approvedBy,
            isExport: params.type === 'export',
            isDeletion: params.type === 'deletion',
            deletionDate: (_a = params.deletionDate) === null || _a === void 0 ? void 0 : _a.toISOString(),
            gracePeriodDays: params.gracePeriodDays || 30,
        },
    });
}
/**
 * Helper: Send data export ready notification
 */
async function notifyDataExportReady(params) {
    const email = await getUserEmail(params.uid);
    await sendNotification({
        uid: params.uid,
        type: 'data_export_ready',
        channels: ['email', 'inApp'],
        email: email || undefined,
        meta: {
            requestId: params.requestId,
            downloadUrl: params.downloadUrl,
            sizeKB: Math.round(params.sizeBytes / 1024),
            generatedAt: new Date().toISOString(),
            expiresAt: params.expiresAt.toISOString(),
        },
    });
}
/**
 * Helper: Send account deleted notification
 */
async function notifyAccountDeleted(params) {
    // For deleted accounts, we need the email passed explicitly
    if (!params.email) {
        console.warn(`Cannot send deletion notification for ${params.uid}: no email provided`);
        return;
    }
    await sendNotification({
        uid: params.uid,
        type: 'account_deleted',
        channels: ['email'], // Only email (user is deleted)
        email: params.email,
        meta: {
            requestId: params.requestId,
            uid: params.uid,
            deletedAt: new Date().toISOString(),
        },
    });
}
//# sourceMappingURL=notifications.js.map