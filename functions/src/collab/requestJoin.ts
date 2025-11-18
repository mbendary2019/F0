// functions/src/collab/requestJoin.ts
// Phase 53: Realtime Collaboration - Join Room Handler

import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { db } from '../config';
import * as jwt from 'jsonwebtoken';

// Types
interface JoinRequest {
  roomId: string;
  projectId: string;
  filePath: string;
  role?: 'editor' | 'viewer';
}

interface JoinResponse {
  success: boolean;
  token?: string;
  iceServers?: RTCIceServer[];
  signalingUrl?: string;
  wsUrl?: string;
  roomId?: string;
  error?: string;
}

interface RoomData {
  roomId: string;
  projectId: string;
  filePath: string;
  orgId: string;
  createdBy: string;
  visibility: 'org' | 'private' | 'link';
  maxPeers: number;
  createdAt: number;
  updatedAt: number;
  activeCount?: number;
}

// Get JWT secret from config or environment
function getJWTSecret(): string {
  const secret = process.env.COLLAB_JWT_SECRET ||
                 functions.params.defineString('COLLAB_JWT_SECRET').value();

  if (!secret || secret === 'demo_secret') {
    console.warn('⚠️ Using demo JWT secret - NOT FOR PRODUCTION');
    return 'demo_jwt_secret_change_in_production_32bytes_minimum';
  }

  return secret;
}

// Get ICE servers from config
function getICEServers(): RTCIceServer[] {
  try {
    const stunUrls = process.env.COLLAB_STUN_URLS ||
                     functions.params.defineString('COLLAB_STUN_URLS').value();
    const turnUrls = process.env.COLLAB_TURN_URLS ||
                     functions.params.defineString('COLLAB_TURN_URLS').value();
    const turnUser = process.env.COLLAB_TURN_USERNAME ||
                     functions.params.defineString('COLLAB_TURN_USERNAME').value();
    const turnPass = process.env.COLLAB_TURN_PASSWORD ||
                     functions.params.defineString('COLLAB_TURN_PASSWORD').value();

    const servers: RTCIceServer[] = [];

    // Add STUN servers
    if (stunUrls) {
      const urls = JSON.parse(stunUrls);
      servers.push({ urls });
    } else {
      // Default STUN servers
      servers.push({
        urls: [
          'stun:stun.l.google.com:19302',
          'stun:global.stun.twilio.com:3478'
        ]
      });
    }

    // Add TURN servers if configured
    if (turnUrls && turnUser && turnPass) {
      const urls = JSON.parse(turnUrls);
      servers.push({
        urls,
        username: turnUser,
        credential: turnPass
      });
    }

    return servers;
  } catch (error) {
    console.error('Error parsing ICE servers config:', error);
    // Return default STUN servers
    return [{
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:global.stun.twilio.com:3478'
      ]
    }];
  }
}

/**
 * Callable function to request joining a collaboration room
 * Returns a signed JWT token and ICE server configuration
 */
export const requestJoin = functions.https.onCall<JoinRequest, Promise<JoinResponse>>(
  async (request) => {
    const { auth, data } = request;

    // 1. Check authentication
    if (!auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to join a collaboration room'
      );
    }

    const { roomId, projectId, filePath, role = 'editor' } = data;

    // 2. Validate input
    if (!roomId || !projectId || !filePath) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'roomId, projectId, and filePath are required'
      );
    }

    const userId = auth.uid;
    const userEmail = auth.token.email || 'unknown';
    const orgId = auth.token.orgId as string | undefined;

    try {
      // 3. Check or create room
      const roomRef = db.collection('collab_rooms').doc(roomId);
      const roomSnap = await roomRef.get();

      let roomData: RoomData;

      if (!roomSnap.exists) {
        // Create new room
        if (!orgId) {
          throw new functions.https.HttpsError(
            'permission-denied',
            'User must belong to an organization to create rooms'
          );
        }

        roomData = {
          roomId,
          projectId,
          filePath,
          orgId,
          createdBy: userId,
          visibility: 'org',
          maxPeers: 12,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          activeCount: 0
        };

        await roomRef.set(roomData);
        console.log(`✅ Created new room: ${roomId}`);
      } else {
        roomData = roomSnap.data() as RoomData;

        // 4. Check permissions
        if (roomData.visibility === 'org' && roomData.orgId !== orgId) {
          throw new functions.https.HttpsError(
            'permission-denied',
            'User does not have access to this room'
          );
        }

        if (roomData.visibility === 'private' && roomData.createdBy !== userId) {
          throw new functions.https.HttpsError(
            'permission-denied',
            'This is a private room'
          );
        }

        // 5. Check max peers
        const activeCount = roomData.activeCount || 0;
        if (activeCount >= roomData.maxPeers) {
          throw new functions.https.HttpsError(
            'resource-exhausted',
            `Room is full (max ${roomData.maxPeers} peers)`
          );
        }
      }

      // 6. Create session document
      const sessionId = `sess_${userId}_${Date.now()}`;
      const sessionRef = roomRef.collection('sessions').doc(sessionId);

      await sessionRef.set({
        sessionId,
        userId,
        displayName: auth.token.name || userEmail.split('@')[0] || 'Anonymous',
        email: userEmail,
        color: generateUserColor(userId),
        role,
        joinedAt: Date.now(),
        leftAt: null,
        clientInfo: {
          agent: 'F0 IDE',
          version: '1.0.0'
        }
      });

      // 7. Increment active count
      await roomRef.update({
        activeCount: admin.firestore.FieldValue.increment(1),
        updatedAt: Date.now()
      });

      // 8. Generate JWT token
      const jwtSecret = getJWTSecret();
      const token = jwt.sign(
        {
          roomId,
          userId,
          sessionId,
          role,
          orgId,
          aud: 'collab.f0.app',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + (30 * 60) // 30 minutes
        },
        jwtSecret
      );

      // 9. Get ICE servers
      const iceServers = getICEServers();

      // 10. Return response
      const signalingUrl = process.env.COLLAB_SIGNALING_URL ||
                          'wss://collab-signal.f0.app';
      const wsUrl = process.env.COLLAB_WS_URL ||
                   'wss://collab-ws.f0.app';

      console.log(`✅ User ${userId} joined room ${roomId} with role ${role}`);

      return {
        success: true,
        token,
        iceServers,
        signalingUrl,
        wsUrl,
        roomId
      };

    } catch (error: any) {
      console.error('Error in requestJoin:', error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        'internal',
        'Failed to join collaboration room',
        error.message
      );
    }
  }
);

/**
 * Generate a consistent color for a user based on their ID
 */
function generateUserColor(userId: string): string {
  const colors = [
    '#6C5CE7', // Purple
    '#00B894', // Green
    '#0984E3', // Blue
    '#FD79A8', // Pink
    '#FDCB6E', // Yellow
    '#E17055', // Orange
    '#74B9FF', // Light Blue
    '#A29BFE', // Light Purple
    '#55EFC4', // Mint
    '#FF7675'  // Red
  ];

  // Use hash of userId to pick color
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}
