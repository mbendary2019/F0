// src/components/deploy/WebDeployGateModal.tsx
// =============================================================================
// Phase 150.4.3 – Web Deploy Gate Modal
// Detailed view of gate status, quality, security, tests, and reasons
// =============================================================================
'use client';

import React from 'react';
import {
  type GateDecision,
  type GateInputs,
  type GateReasonCode,
  getReasonLabel,
  getStatusLabel,
} from '@/shared/quality/deployGateEngine';

interface WebDeployGateModalProps {
  decision: GateDecision;
  inputs: GateInputs;
  onClose: () => void;
  locale?: 'en' | 'ar';
}

/**
 * Modal showing deploy gate details
 */
export function WebDeployGateModal({
  decision,
  inputs,
  onClose,
  locale = 'en',
}: WebDeployGateModalProps) {
  const isArabic = locale === 'ar';
  const statusLabel = getStatusLabel(decision.status, locale);

  const statusConfig = {
    ready: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      text: 'text-emerald-300',
      icon: '✅',
    },
    warning: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      text: 'text-amber-300',
      icon: '⚠️',
    },
    blocked: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      text: 'text-red-300',
      icon: '🚫',
    },
  };

  const config = statusConfig[decision.status];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-lg rounded-2xl bg-[#0b0616] border border-white/10 shadow-2xl shadow-purple-900/60 overflow-hidden"
        dir={isArabic ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-gradient-to-r from-purple-900/20 to-transparent">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <span className="text-lg">🚀</span>
              {isArabic ? 'بوابة النشر' : 'Deploy Gate'}
            </h2>
            <p className="text-[11px] text-white/50 mt-0.5">
              {isArabic
                ? 'تحقق من جاهزية المشروع للنشر'
                : 'Check project readiness for deployment'
              }
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-white/70 hover:bg-white/5 transition"
          >
            {isArabic ? 'إغلاق' : 'Close'}
          </button>
        </div>

        {/* Status Banner */}
        <div className={`mx-5 mt-5 rounded-xl ${config.bg} ${config.border} border p-4`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{config.icon}</span>
            <div>
              <p className={`text-lg font-semibold ${config.text}`}>
                {statusLabel}
              </p>
              <p className="text-xs text-white/50">
                {decision.reasons.length > 0
                  ? (isArabic
                      ? `${decision.reasons.length} سبب يتطلب الانتباه`
                      : `${decision.reasons.length} reason(s) require attention`)
                  : (isArabic
                      ? 'لا توجد مشاكل'
                      : 'No issues detected')
                }
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-auto">
          {/* Quality Panel */}
          <GatePanel
            title={isArabic ? 'الجودة' : 'Quality'}
            icon="💎"
            locale={locale}
          >
            {inputs.quality ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/60">
                    {isArabic ? 'الدرجة' : 'Score'}
                  </span>
                  <span className={`text-sm font-semibold ${
                    inputs.quality.score >= 80 ? 'text-emerald-400' :
                    inputs.quality.score >= 60 ? 'text-amber-400' :
                    'text-red-400'
                  }`}>
                    {inputs.quality.score}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/60">
                    {isArabic ? 'الحالة' : 'Status'}
                  </span>
                  <StatusBadge status={inputs.quality.status} locale={locale} />
                </div>
                {inputs.quality.totalIssues !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/60">
                      {isArabic ? 'المشاكل' : 'Issues'}
                    </span>
                    <span className="text-sm text-white/80">
                      {inputs.quality.totalIssues}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-white/50">
                {isArabic ? 'لا توجد بيانات' : 'No data available'}
              </p>
            )}
          </GatePanel>

          {/* Security Panel */}
          <GatePanel
            title={isArabic ? 'الأمان' : 'Security'}
            icon="🔒"
            locale={locale}
          >
            {inputs.security ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/60">
                    {isArabic ? 'التنبيهات' : 'Alerts'}
                  </span>
                  <span className={`text-sm font-semibold ${
                    inputs.security.totalAlerts === 0 ? 'text-emerald-400' :
                    'text-red-400'
                  }`}>
                    {inputs.security.totalAlerts}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/60">
                    {isArabic ? 'حظر النشر' : 'Blocking'}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    inputs.security.hasBlocking
                      ? 'bg-red-500/15 text-red-300'
                      : 'bg-emerald-500/15 text-emerald-300'
                  }`}>
                    {inputs.security.hasBlocking
                      ? (isArabic ? 'نعم' : 'Yes')
                      : (isArabic ? 'لا' : 'No')
                    }
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-white/50">
                {isArabic ? 'لا توجد بيانات' : 'No data available'}
              </p>
            )}
          </GatePanel>

          {/* Tests Panel */}
          <GatePanel
            title={isArabic ? 'الاختبارات' : 'Tests'}
            icon="🧪"
            locale={locale}
          >
            {inputs.tests ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/60">
                    {isArabic ? 'الحالة' : 'Status'}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    inputs.tests.status === 'ok'
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : inputs.tests.status === 'failing'
                      ? 'bg-red-500/15 text-red-300'
                      : 'bg-amber-500/15 text-amber-300'
                  }`}>
                    {inputs.tests.status === 'ok'
                      ? (isArabic ? 'ناجح' : 'Passing')
                      : inputs.tests.status === 'failing'
                      ? (isArabic ? 'فاشل' : 'Failing')
                      : (isArabic ? 'لم يُشغّل' : 'Not Run')
                    }
                  </span>
                </div>
                {inputs.tests.coverage !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/60">
                      {isArabic ? 'التغطية' : 'Coverage'}
                    </span>
                    <span className={`text-sm font-semibold ${
                      inputs.tests.coverage >= 70 ? 'text-emerald-400' :
                      inputs.tests.coverage >= 50 ? 'text-amber-400' :
                      'text-red-400'
                    }`}>
                      {inputs.tests.coverage}%
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-white/50">
                {isArabic ? 'لا توجد بيانات' : 'No data available'}
              </p>
            )}
          </GatePanel>

          {/* Reasons Panel */}
          {decision.reasons.length > 0 && (
            <GatePanel
              title={isArabic ? 'الأسباب' : 'Reasons'}
              icon="📋"
              locale={locale}
            >
              <ul className="space-y-2">
                {decision.reasons.map((reason) => (
                  <li
                    key={reason}
                    className="flex items-center gap-2 text-xs text-white/80"
                  >
                    <span className="text-red-400">•</span>
                    {getReasonLabel(reason, locale)}
                  </li>
                ))}
              </ul>
            </GatePanel>
          )}

          {/* Policy Panel */}
          <GatePanel
            title={isArabic ? 'السياسة' : 'Policy'}
            icon="⚙️"
            locale={locale}
          >
            <div className="space-y-2 text-xs text-white/60">
              <div className="flex items-center justify-between">
                <span>{isArabic ? 'الحد الأدنى للصحة' : 'Min Health'}</span>
                <span className="text-white/80">{inputs.policy.minHealthForOK}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{isArabic ? 'حظر عند تنبيهات أمنية' : 'Block on Security'}</span>
                <span className="text-white/80">
                  {inputs.policy.blockOnSecurityAlerts
                    ? (isArabic ? 'نعم' : 'Yes')
                    : (isArabic ? 'لا' : 'No')
                  }
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>{isArabic ? 'تتطلب اختبارات' : 'Require Tests'}</span>
                <span className="text-white/80">
                  {inputs.policy.requireRecentTests
                    ? (isArabic ? 'نعم' : 'Yes')
                    : (isArabic ? 'لا' : 'No')
                  }
                </span>
              </div>
            </div>
          </GatePanel>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-white/5 bg-white/[0.02]">
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-1.5 text-xs text-white/70 hover:bg-white/5 transition"
          >
            {isArabic ? 'إغلاق' : 'Close'}
          </button>
          {decision.status === 'ready' && (
            <button
              className="rounded-lg bg-emerald-600/80 px-4 py-1.5 text-xs font-medium text-white shadow-md shadow-emerald-700/40 hover:bg-emerald-500 transition"
            >
              {isArabic ? 'بدء النشر' : 'Start Deploy'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Panel wrapper component
 */
function GatePanel({
  title,
  icon,
  locale,
  children,
}: {
  title: string;
  icon: string;
  locale: 'en' | 'ar';
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">{icon}</span>
        <span className="text-sm font-medium text-white/80">{title}</span>
      </div>
      {children}
    </div>
  );
}

/**
 * Status badge for quality status
 */
function StatusBadge({
  status,
  locale,
}: {
  status: 'good' | 'caution' | 'needs_work' | 'blocked';
  locale: 'en' | 'ar';
}) {
  const isArabic = locale === 'ar';

  const config = {
    good: {
      label: isArabic ? 'جيد' : 'Good',
      className: 'bg-emerald-500/15 text-emerald-300',
    },
    caution: {
      label: isArabic ? 'تحذير' : 'Caution',
      className: 'bg-amber-500/15 text-amber-300',
    },
    needs_work: {
      label: isArabic ? 'يحتاج عمل' : 'Needs Work',
      className: 'bg-orange-500/15 text-orange-300',
    },
    blocked: {
      label: isArabic ? 'محظور' : 'Blocked',
      className: 'bg-red-500/15 text-red-300',
    },
  };

  const c = config[status];

  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full ${c.className}`}>
      {c.label}
    </span>
  );
}

export default WebDeployGateModal;
