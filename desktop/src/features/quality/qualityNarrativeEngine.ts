// desktop/src/features/quality/qualityNarrativeEngine.ts
// Phase 140.10: Quality Narrative Engine
// Generates human-readable quality stories from snapshots and events

import type {
  QualityStatus,
  QualityStorySnapshot,
  QualityStoryEvent,
  QualityNarrative,
  QualityNarrativeSection,
  QualityDeltas,
  NarrativeHighlight,
} from '../../types/qualityStory';

type Locale = 'en' | 'ar';

/* -------------------------------------------------------------------------- */
/*  Helper Functions                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Filter events from the last 7 days
 */
function filterLast7Days(events: QualityStoryEvent[]): QualityStoryEvent[] {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return events.filter((e) => {
    const ts = new Date(e.timestamp).getTime();
    return ts >= sevenDaysAgo;
  });
}

/**
 * Compute deltas between first and last snapshot
 */
function computeDeltas(snapshots: QualityStorySnapshot[]): QualityDeltas {
  if (snapshots.length < 2) {
    return { healthDelta: 0, coverageDelta: 0, issuesDelta: 0, daysCovered: 0 };
  }

  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];

  const firstTs = new Date(first.timestamp).getTime();
  const lastTs = new Date(last.timestamp).getTime();
  const daysCovered = Math.round((lastTs - firstTs) / (24 * 60 * 60 * 1000));

  return {
    healthDelta: (last.health ?? 0) - (first.health ?? 0),
    coverageDelta: (last.coverage ?? 0) - (first.coverage ?? 0),
    issuesDelta: (last.issues ?? 0) - (first.issues ?? 0),
    daysCovered,
  };
}

/**
 * Generate unique ID for sections
 */
function genId(): string {
  return Math.random().toString(36).substring(2, 9);
}

/* -------------------------------------------------------------------------- */
/*  Section Generators                                                         */
/* -------------------------------------------------------------------------- */

function makeOverviewSection(
  status: QualityStatus,
  latest: QualityStorySnapshot | undefined,
  deltas: QualityDeltas,
  weekEvents: QualityStoryEvent[],
  locale: Locale
): QualityNarrativeSection {
  const health = latest?.health ?? 0;
  const blockingSecurity = latest?.blockingSecurityAlerts ?? 0;
  const securityAlerts = latest?.securityAlerts ?? 0;

  let highlight: NarrativeHighlight = 'info';
  let body = '';

  if (status === 'BLOCK') {
    highlight = 'danger';
    if (locale === 'ar') {
      body = `المشروع حاليًا في حالة حظر نشر. مستوى الصحة عند ${health}%`;
      if (blockingSecurity > 0) {
        body += ` مع وجود ${blockingSecurity} تنبيه أمان حاجز.`;
      } else {
        body += '.';
      }
    } else {
      body = `Your project is currently blocked from deploying. Health is at ${health}%`;
      if (blockingSecurity > 0) {
        body += ` with ${blockingSecurity} blocking security alert${blockingSecurity > 1 ? 's' : ''}.`;
      } else {
        body += '.';
      }
    }
  } else if (status === 'CAUTION') {
    highlight = 'warning';
    if (locale === 'ar') {
      body = `يمكنك النشر، لكن هناك مخاطر مفتوحة. الصحة عند ${health}%`;
      if (securityAlerts > 0) {
        body += ` مع ${securityAlerts} تحذير أمني يحتاج مراجعة.`;
      } else {
        body += '.';
      }
    } else {
      body = `You can still deploy, but there are open risks. Health is ${health}%`;
      if (securityAlerts > 0) {
        body += ` and there ${securityAlerts > 1 ? 'are' : 'is'} ${securityAlerts} security warning${securityAlerts > 1 ? 's' : ''} that should be reviewed.`;
      } else {
        body += '.';
      }
    }
  } else {
    highlight = 'success';
    if (locale === 'ar') {
      body = `المشروع جاهز للنشر! الصحة عند ${health}% ولا توجد مشاكل أمان حرجة.`;
    } else {
      body = `Project is ready to deploy! Health is at ${health}% with no blocking security issues.`;
    }
  }

  return {
    id: genId(),
    type: 'overview',
    title: locale === 'ar' ? 'نظرة عامة' : 'Overview',
    body,
    highlight,
  };
}

function makeHealthTrendSection(
  deltas: QualityDeltas,
  weekEvents: QualityStoryEvent[],
  locale: Locale
): QualityNarrativeSection {
  const { healthDelta, daysCovered } = deltas;
  const direction = healthDelta > 0 ? 'up' : healthDelta < 0 ? 'down' : 'stable';

  let highlight: NarrativeHighlight = 'info';
  let body = '';

  if (direction === 'down' && Math.abs(healthDelta) >= 5) {
    highlight = 'warning';
    if (locale === 'ar') {
      body = `انخفضت الصحة بمقدار ${Math.abs(healthDelta).toFixed(1)} نقطة خلال الأسبوع الماضي.`;
      const securityEvents = weekEvents.filter(
        (e) => e.type === 'SECURITY_ALERT'
      ).length;
      if (securityEvents > 0) {
        body += ` يبدو أن ${securityEvents} تنبيه أمان ساهم في هذا الانخفاض.`;
      }
    } else {
      body = `Health dropped by ${Math.abs(healthDelta).toFixed(1)} points over the past week.`;
      const securityEvents = weekEvents.filter(
        (e) => e.type === 'SECURITY_ALERT'
      ).length;
      if (securityEvents > 0) {
        body += ` ${securityEvents} security alert${securityEvents > 1 ? 's' : ''} contributed to this drop.`;
      }
    }
  } else if (direction === 'up' && healthDelta >= 3) {
    highlight = 'success';
    if (locale === 'ar') {
      body = `تحسنت الصحة بمقدار ${healthDelta.toFixed(1)} نقطة! استمر في العمل الجيد.`;
    } else {
      body = `Health improved by ${healthDelta.toFixed(1)} points! Keep up the good work.`;
    }
  } else {
    if (locale === 'ar') {
      body = `الصحة مستقرة نسبيًا (${healthDelta >= 0 ? '+' : ''}${healthDelta.toFixed(1)} نقطة).`;
    } else {
      body = `Health is relatively stable (${healthDelta >= 0 ? '+' : ''}${healthDelta.toFixed(1)} points).`;
    }
  }

  return {
    id: genId(),
    type: 'health_trend',
    title: locale === 'ar' ? 'اتجاه الصحة' : 'Health Trend',
    body,
    highlight,
  };
}

function makeCoverageTrendSection(
  deltas: QualityDeltas,
  locale: Locale
): QualityNarrativeSection {
  const { coverageDelta } = deltas;
  const direction = coverageDelta > 0 ? 'up' : coverageDelta < 0 ? 'down' : 'stable';

  let highlight: NarrativeHighlight = 'info';
  let body = '';

  if (direction === 'down') {
    highlight = 'warning';
    if (locale === 'ar') {
      body = `التغطية انخفضت بمقدار ${Math.abs(coverageDelta).toFixed(1)}% هذا الأسبوع. ركز على كتابة اختبارات للملفات عالية المخاطر.`;
    } else {
      body = `Coverage dropped by ${Math.abs(coverageDelta).toFixed(1)}% this week. Focus on writing tests for high-risk files.`;
    }
  } else if (direction === 'up') {
    highlight = 'success';
    if (locale === 'ar') {
      body = `التغطية زادت بمقدار ${coverageDelta.toFixed(1)}% هذا الأسبوع. ممتاز!`;
    } else {
      body = `Coverage increased by ${coverageDelta.toFixed(1)}% this week. Excellent!`;
    }
  } else {
    if (locale === 'ar') {
      body = `التغطية ثابتة تقريبًا. فكر في تشغيل ATP لتوليد اختبارات إضافية.`;
    } else {
      body = `Coverage is nearly flat. Consider running ATP to generate additional tests.`;
    }
  }

  return {
    id: genId(),
    type: 'coverage_trend',
    title: locale === 'ar' ? 'اتجاه التغطية' : 'Coverage Trend',
    body,
    highlight,
  };
}

function makeSecuritySection(
  securityEvents: QualityStoryEvent[],
  latest: QualityStorySnapshot | undefined,
  locale: Locale
): QualityNarrativeSection {
  const blockingCount = securityEvents.filter(
    (e) => e.type === 'SECURITY_ALERT' && (e.blockingSecurityAlerts ?? 0) > 0
  ).length;
  const warningCount = securityEvents.length - blockingCount;

  let highlight: NarrativeHighlight = blockingCount > 0 ? 'danger' : 'warning';
  let body = '';

  if (locale === 'ar') {
    if (blockingCount > 0) {
      body = `يوجد ${blockingCount} تنبيه أمان حرج يمنع النشر.`;
      if (warningCount > 0) {
        body += ` بالإضافة إلى ${warningCount} تحذير أمني.`;
      }
      body += ' يجب حل هذه المشاكل قبل أي نشر.';
    } else {
      body = `يوجد ${warningCount} تحذير أمني هذا الأسبوع. راجعها قبل النشر.`;
    }
  } else {
    if (blockingCount > 0) {
      body = `There ${blockingCount > 1 ? 'are' : 'is'} ${blockingCount} blocking security alert${blockingCount > 1 ? 's' : ''} preventing deployment.`;
      if (warningCount > 0) {
        body += ` Plus ${warningCount} security warning${warningCount > 1 ? 's' : ''}.`;
      }
      body += ' These must be resolved before deploying.';
    } else {
      body = `There ${warningCount > 1 ? 'are' : 'is'} ${warningCount} security warning${warningCount > 1 ? 's' : ''} this week. Review before deploying.`;
    }
  }

  return {
    id: genId(),
    type: 'security_risks',
    title: locale === 'ar' ? 'مخاطر الأمان' : 'Security Risks',
    body,
    highlight,
  };
}

function makeTestingActivitySection(
  weekEvents: QualityStoryEvent[],
  latest: QualityStorySnapshot | undefined,
  locale: Locale
): QualityNarrativeSection {
  const atpRuns = weekEvents.filter((e) => e.type === 'ATP_RUN').length;
  const autoImproves = weekEvents.filter((e) => e.type === 'AUTO_IMPROVE').length;
  const deploys = weekEvents.filter((e) => e.type === 'DEPLOY').length;

  let highlight: NarrativeHighlight = 'info';
  let body = '';

  if (locale === 'ar') {
    body = `خلال الأسبوع: `;
    const parts = [];
    if (atpRuns > 0) parts.push(`${atpRuns} تشغيل ATP`);
    if (autoImproves > 0) parts.push(`${autoImproves} تحسين آلي`);
    if (deploys > 0) parts.push(`${deploys} عملية نشر`);

    if (parts.length === 0) {
      body = 'لا يوجد نشاط اختبار هذا الأسبوع. فكر في تشغيل ATP.';
      highlight = 'warning';
    } else {
      body += parts.join('، ') + '.';
      if (atpRuns >= 2 || autoImproves >= 1) {
        highlight = 'success';
      }
    }
  } else {
    body = `This week: `;
    const parts = [];
    if (atpRuns > 0) parts.push(`${atpRuns} ATP run${atpRuns > 1 ? 's' : ''}`);
    if (autoImproves > 0)
      parts.push(`${autoImproves} auto-improve${autoImproves > 1 ? 's' : ''}`);
    if (deploys > 0) parts.push(`${deploys} deploy${deploys > 1 ? 's' : ''}`);

    if (parts.length === 0) {
      body = 'No testing activity this week. Consider running ATP.';
      highlight = 'warning';
    } else {
      body += parts.join(', ') + '.';
      if (atpRuns >= 2 || autoImproves >= 1) {
        highlight = 'success';
      }
    }
  }

  return {
    id: genId(),
    type: 'testing_activity',
    title: locale === 'ar' ? 'نشاط الاختبار' : 'Testing Activity',
    body,
    highlight,
  };
}

function makeRecommendationSection(
  status: QualityStatus,
  latest: QualityStorySnapshot | undefined,
  deltas: QualityDeltas,
  weekEvents: QualityStoryEvent[],
  locale: Locale
): QualityNarrativeSection {
  const blockingSecurity = latest?.blockingSecurityAlerts ?? 0;
  const securityAlerts = latest?.securityAlerts ?? 0;
  const coverage = latest?.coverage ?? 0;
  const { coverageDelta, healthDelta } = deltas;

  let body = '';
  let highlight: NarrativeHighlight = 'info';

  // Priority: Blocking security > Low coverage > Health drop > General
  if (blockingSecurity > 0) {
    highlight = 'danger';
    if (locale === 'ar') {
      body = `أولوية رقم ١: حلّ تنبيهات الأمان الحاجزة قبل أي نشر جديد. شغّل Auto-Improve مع خيار 'Security fix'، ثم أعد تشغيل ATP للتأكد أن الحالة استقرّت.`;
    } else {
      body = `Priority #1: Resolve blocking security alerts before any new deploy. Run Auto-Improve with 'Security fix' option, then re-run ATP to verify the state has stabilized.`;
    }
  } else if (coverage < 40 || coverageDelta < -5) {
    highlight = 'warning';
    if (locale === 'ar') {
      body = `التغطية ضعيفة أو في تراجع. ركّز على ملفات high-risk، وشغّل ATP لتوليد اختبارات إضافية للـ API والـ utilities.`;
    } else {
      body = `Coverage is low or declining. Focus on high-risk files and run ATP to generate additional tests for APIs and utilities.`;
    }
  } else if (healthDelta < -5) {
    highlight = 'warning';
    if (locale === 'ar') {
      body = `الصحة انخفضت بشكل ملحوظ. راجع التغييرات الأخيرة وشغّل Auto-Improve للتحسين التلقائي.`;
    } else {
      body = `Health has dropped significantly. Review recent changes and run Auto-Improve for automatic fixes.`;
    }
  } else if (status === 'OK') {
    highlight = 'success';
    if (locale === 'ar') {
      body = `المشروع في حالة جيدة! استمر في المراقبة وشغّل ATP دوريًا للحفاظ على الجودة.`;
    } else {
      body = `Project is in good shape! Keep monitoring and run ATP periodically to maintain quality.`;
    }
  } else {
    if (locale === 'ar') {
      body = `راجع التحذيرات الحالية قبل النشر. شغّل Auto-Improve لتحسين الوضع.`;
    } else {
      body = `Review current warnings before deploying. Run Auto-Improve to improve the state.`;
    }
  }

  return {
    id: genId(),
    type: 'recommendation',
    title: locale === 'ar' ? 'التوصية' : 'Recommendation',
    body,
    highlight,
  };
}

/* -------------------------------------------------------------------------- */
/*  Main Export                                                               */
/* -------------------------------------------------------------------------- */

export interface BuildNarrativeOptions {
  status: QualityStatus;
  snapshots: QualityStorySnapshot[];
  events: QualityStoryEvent[];
  locale?: Locale;
}

/**
 * Build a complete quality narrative from snapshots and events
 */
export function buildQualityNarrative(opts: BuildNarrativeOptions): QualityNarrative {
  const { status, snapshots, events, locale = 'en' } = opts;

  const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : undefined;
  const weekEvents = filterLast7Days(events);
  const deltas = computeDeltas(snapshots);

  const sections: QualityNarrativeSection[] = [];

  // 1) Overview - always included
  sections.push(makeOverviewSection(status, latest, deltas, weekEvents, locale));

  // 2) Health trend - if significant change or events
  if (Math.abs(deltas.healthDelta) >= 3 || weekEvents.length > 0) {
    sections.push(makeHealthTrendSection(deltas, weekEvents, locale));
  }

  // 3) Coverage trend - if significant change
  if (Math.abs(deltas.coverageDelta) >= 1) {
    sections.push(makeCoverageTrendSection(deltas, locale));
  }

  // 4) Security - if there are security events
  const securityEvents = weekEvents.filter(
    (e) => e.type === 'SECURITY_ALERT' || e.type === 'SECURITY_CLEAR'
  );
  if (securityEvents.length > 0 || (latest?.blockingSecurityAlerts ?? 0) > 0) {
    sections.push(makeSecuritySection(securityEvents, latest, locale));
  }

  // 5) Testing activity - always included
  sections.push(makeTestingActivitySection(weekEvents, latest, locale));

  // 6) Recommendation - always included at the end
  sections.push(makeRecommendationSection(status, latest, deltas, weekEvents, locale));

  return {
    status,
    sections,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Get a short summary sentence for the quality status
 */
export function getQualityStatusSummary(
  status: QualityStatus,
  health: number,
  locale: Locale = 'en'
): string {
  if (status === 'BLOCK') {
    return locale === 'ar'
      ? `محظور - الصحة ${health}%`
      : `Blocked - Health ${health}%`;
  } else if (status === 'CAUTION') {
    return locale === 'ar'
      ? `تحذير - الصحة ${health}%`
      : `Caution - Health ${health}%`;
  }
  return locale === 'ar'
    ? `جاهز - الصحة ${health}%`
    : `Ready - Health ${health}%`;
}
