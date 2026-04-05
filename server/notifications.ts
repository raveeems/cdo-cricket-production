import * as admin from 'firebase-admin';
import { storage } from './storage';

let initialized = false;

function initFirebase() {
  if (initialized || admin.apps.length > 0) return;
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    initialized = true;
    console.log('[FCM] Firebase Admin initialized');
  } catch (e) {
    console.error('[FCM] Firebase Admin init failed:', e);
  }
}

async function sendToTokens(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  if (!tokens || tokens.length === 0) {
    console.log('[FCM] No tokens to send to');
    return;
  }
  initFirebase();

  const chunks: string[][] = [];
  for (let i = 0; i < tokens.length; i += 500) {
    chunks.push(tokens.slice(i, i + 500));
  }

  for (const chunk of chunks) {
    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: chunk,
        notification: { title, body },
        data: data || {},
        webpush: {
          notification: {
            title,
            body,
            icon: '/icon.png',
            badge: '/icon.png',
            requireInteraction: false,
          },
          fcmOptions: { link: '/' },
        },
      });

      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errCode = resp.error?.code;
          if (
            errCode === 'messaging/invalid-registration-token' ||
            errCode === 'messaging/registration-token-not-registered'
          ) {
            failedTokens.push(chunk[idx]);
          }
        }
      });

      for (const token of failedTokens) {
        await storage.deletePushToken(token);
      }

      console.log(`[FCM] Sent: ${response.successCount} success, ${response.failureCount} failed`);
    } catch (e) {
      console.error('[FCM] Send error:', e);
    }
  }
}

export async function notifyMatchStartingSoon(
  team1Short: string,
  team2Short: string
): Promise<void> {
  try {
    const tokens = (await storage.getPushTokensForIPLUsers()) ?? [];
    console.log(`[FCM] Notifying ${tokens.length} users — match starting soon`);
    await sendToTokens(
      tokens,
      `${team1Short} vs ${team2Short} starts in 30 minutes`,
      'Lock your team now before the deadline closes!',
      { type: 'match_starting' }
    );
  } catch (e) {
    console.error('[FCM] notifyMatchStartingSoon failed:', e);
  }
}

export async function notifyXIAndImpactUpdated(
  team1Short: string,
  team2Short: string
): Promise<void> {
  try {
    const tokens = (await storage.getPushTokensForIPLUsers()) ?? [];
    console.log(`[FCM] Notifying ${tokens.length} users — XI and Impact updated`);
    await sendToTokens(
      tokens,
      `${team1Short} vs ${team2Short} Playing XI & Impact Updated`,
      'The playing XI and impact players are confirmed. Review your team now!',
      { type: 'xi_impact_updated' }
    );
  } catch (e) {
    console.error('[FCM] notifyXIAndImpactUpdated failed:', e);
  }
}

export async function notifyMatchEnded(
  team1Short: string,
  team2Short: string
): Promise<void> {
  try {
    const tokens = (await storage.getPushTokensForIPLUsers()) ?? [];
    console.log(`[FCM] Notifying ${tokens.length} users — match ended`);
    await sendToTokens(
      tokens,
      `${team1Short} vs ${team2Short} has ended`,
      'The match is over — check your points and see where you stand!',
      { type: 'match_ended' }
    );
  } catch (e) {
    console.error('[FCM] notifyMatchEnded failed:', e);
  }
}
