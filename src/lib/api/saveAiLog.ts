// src/lib/api/saveAiLog.ts
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';

export interface SaveAiLogParams {
  projectId: string;
  projectName: string;
  type: 'Plan' | 'Patch' | 'Analysis' | 'Chat';
  description: string;
  status: 'Success' | 'Applied' | 'Info' | 'Failed';
}

/**
 * Save an AI operation log to Firestore via Cloud Function
 */
export async function saveAiLog(params: SaveAiLogParams): Promise<boolean> {
  try {
    const functions = getFunctions(app);
    const saveLog = httpsCallable(functions, 'saveAiLog');

    await saveLog({
      projectId: params.projectId,
      projectName: params.projectName,
      type: params.type,
      description: params.description,
      status: params.status,
    });

    console.log('[saveAiLog] Successfully logged AI operation:', params.type);
    return true;
  } catch (error: any) {
    console.error('[saveAiLog] Failed to log AI operation:', error);
    // Don't throw - we don't want logging failures to break the main flow
    return false;
  }
}
