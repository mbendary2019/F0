// functions/src/integrations/vercel-setup.ts
import * as logger from "firebase-functions/logger";
import { onCall } from "firebase-functions/v2/https";
import fetch from "node-fetch";

// Helper لاستدعاء Vercel API
async function vercelRequest(path: string, token: string): Promise<any> {
  const url = `https://api.vercel.com${path}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    logger.error("[Vercel] API error", { status: res.status, json });
    const errorData = json as any;
    throw new Error(`Vercel API error: ${res.status} ${errorData?.error?.message || ""}`);
  }

  return json;
}

/**
 * testVercelToken
 * يتأكد إن التوكن شغال + يرجع معلومات بسيطة عن الحساب والفريق
 */
export const testVercelToken = onCall(async () => {
  const token = process.env.F0_VERCEL_TOKEN;

  if (!token) {
    throw new Error("F0_VERCEL_TOKEN is not set in functions/.env");
  }

  logger.info("[Vercel] Testing token...");

  // 1) معلومات المستخدم / الحساب
  const userData = await vercelRequest("/v2/user", token) as any;

  // 2) نجيب أول شوية مشاريع بس للتأكيد
  const projectsData = await vercelRequest("/v9/projects?limit=10", token) as any;

  logger.info("[Vercel] Token OK", {
    user: userData.user?.username || userData.user?.name || userData.user?.email,
    projectCount: projectsData.projects?.length || 0,
  });

  return {
    ok: true,
    user: {
      id: userData.user?.id,
      name: userData.user?.name,
      email: userData.user?.email,
      username: userData.user?.username,
    },
    projects: (projectsData.projects || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      framework: p.framework,
      createdAt: p.createdAt,
    })),
  };
});

/**
 * listVercelProjects
 * هنحتاجها لاحقاً في Project Integrations لاختيار المشروع
 */
export const listVercelProjects = onCall(async () => {
  const token = process.env.F0_VERCEL_TOKEN;
  if (!token) throw new Error("F0_VERCEL_TOKEN is not set");

  const projectsData = await vercelRequest("/v9/projects?limit=50", token) as any;

  return {
    ok: true,
    projects: (projectsData.projects || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      framework: p.framework,
      createdAt: p.createdAt,
    })),
  };
});
