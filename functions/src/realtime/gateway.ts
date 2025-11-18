/**
 * Real-Time WebSocket Gateway
 * Provides live updates for admin dashboard
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Server as WebSocketServer } from 'ws';
import * as http from 'http';
import * as url from 'url';

if (!admin.apps.length) admin.initializeApp();

type Client = {
  ws: any;
  uid: string;
  isAdmin: boolean;
};

const clients = new Set<Client>();

/**
 * Broadcast event to all connected admin clients
 */
function broadcast(event: string, payload: unknown) {
  const data = JSON.stringify({ event, payload, ts: Date.now() });
  for (const c of clients) {
    if (c.isAdmin && c.ws.readyState === 1) { // 1 = OPEN
      try {
        c.ws.send(data);
      } catch (err) {
        console.error('[broadcast] Send error:', err);
      }
    }
  }
}

/**
 * Extract UID from session cookie
 * TODO: Replace with real session verification in production
 */
async function getUidFromCookie(cookieHeader?: string | null): Promise<string | null> {
  if (!cookieHeader) return null;
  
  try {
    // Parse session cookie
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const sessionCookie = cookies.find(c => c.startsWith('session='));
    
    if (!sessionCookie) return null;
    
    const token = sessionCookie.split('=')[1];
    if (!token) return null;
    
    // Verify session cookie with Firebase Admin
    const decodedToken = await admin.auth().verifySessionCookie(token, true);
    return decodedToken.uid;
  } catch (err) {
    console.error('[getUidFromCookie] Error:', err);
    return null;
  }
}

/**
 * Check if user is admin
 * TODO: Connect to your actual admin check (Firestore or Custom Claims)
 */
async function isAdmin(uid: string): Promise<boolean> {
  try {
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(uid).get();
    const roles = userDoc.data()?.roles || [];
    return roles.includes('admin');
  } catch (err) {
    console.error('[isAdmin] Error:', err);
    return false;
  }
}

/**
 * WebSocket Gateway Cloud Function
 * Endpoint: wss://your-function-url/admin-live
 */
export const wsGateway = functions
  .runWith({ memory: '512MB', timeoutSeconds: 300 })
  .https.onRequest(async (req, res) => {
    // Check for WebSocket upgrade
    if (req.headers['upgrade'] !== 'websocket') {
      res.status(426).send('Expected WebSocket');
      return;
    }

    const srv = new http.Server();
    const wss = new WebSocketServer({ noServer: true });

    srv.on('upgrade', async (request, socket, head) => {
      const { pathname } = url.parse(request.url || '');
      
      // Only accept /admin-live path
      if (pathname !== '/admin-live') {
        socket.destroy();
        return;
      }

      // Authenticate via session cookie
      const uid = await getUidFromCookie(request.headers.cookie || null);
      if (!uid) {
        console.log('[wsGateway] No UID from cookie');
        socket.destroy();
        return;
      }

      const okAdmin = await isAdmin(uid);
      if (!okAdmin) {
        console.log('[wsGateway] User is not admin:', uid);
        socket.destroy();
        return;
      }

      // Upgrade connection
      wss.handleUpgrade(request, socket as any, head, (ws) => {
        const client: Client = { ws, uid, isAdmin: okAdmin };
        clients.add(client);
        
        console.log(`[wsGateway] Admin connected: ${uid} (total: ${clients.size})`);

        ws.on('close', () => {
          clients.delete(client);
          console.log(`[wsGateway] Admin disconnected: ${uid} (total: ${clients.size})`);
        });

        ws.on('error', (err: Error) => {
          console.error('[wsGateway] WebSocket error:', err);
          clients.delete(client);
        });

        // Send welcome message
        ws.send(JSON.stringify({
          event: 'hello',
          payload: { ok: true, uid },
          ts: Date.now()
        }));
      });
    });

    // Connect temporary server and end response
    srv.emit('request', req, res);
  });

/**
 * Stream audit events to WebSocket clients
 * Triggered when new audit log is created
 */
export const streamAudit = functions.firestore
  .document('admin_audit/{id}')
  .onCreate(async (snap) => {
    const data = snap.data();
    console.log('[streamAudit] Broadcasting audit event:', snap.id);
    broadcast('audit_new', { id: snap.id, ...data });
  });

/**
 * Stream metrics updates to WebSocket clients
 * Triggered when daily metrics are updated
 */
export const streamMetrics = functions.firestore
  .document('api_metrics_daily/{date}')
  .onWrite(async (change, context) => {
    const after = change.after.exists ? change.after.data() : null;
    if (after) {
      console.log('[streamMetrics] Broadcasting metrics update:', context.params.date);
      broadcast('metrics_update', { date: context.params.date, ...after });
    }
  });

/**
 * Export broadcast function for use by other functions
 */
export { broadcast };

