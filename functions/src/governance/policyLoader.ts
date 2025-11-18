/**
 * Phase 39 - Governance Policy Loader
 * Loads and manages governance policies from YAML/JSON
 */

import * as admin from 'firebase-admin';
import YAML from 'yaml';

const db = admin.firestore();

/**
 * Upsert a governance policy from YAML source
 */
export async function upsertPolicyFromYaml(yamlSrc: string, actor = 'admin') {
  const y: any = YAML.parse(yamlSrc);
  const id = `${y.id}@${y.version}`;
  const doc = {
    id: y.id,
    version: y.version,
    status: y.status || 'active',
    createdAt: Date.now(),
    createdBy: actor,
    format: 'yaml',
    rules: y.rules,
    raw: yamlSrc,
    tags: y.tags || [],
  };
  await db.collection('ops_governance_policies').doc(id).set(doc);
  return id;
}

/**
 * Load all active governance policies
 */
export async function loadActivePolicies() {
  const snap = await db
    .collection('ops_governance_policies')
    .where('status', '==', 'active')
    .get();
  return snap.docs.map((d) => d.data());
}
