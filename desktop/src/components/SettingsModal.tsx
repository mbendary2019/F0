// desktop/src/components/SettingsModal.tsx
// Phase 119.3: Added tabs with Keyboard Shortcuts settings
// Phase 135.1: Added Quality Policy settings tab
import React, { useState, useEffect } from 'react';
import type { F0DesktopSettings } from '../f0/apiClient';
import { loadSettingsFromStorage, saveSettingsToStorage } from '../hooks/useDesktopSettings';
import { testCloudAgentConnection, type CloudAgentConfig } from '../services/cloudAgent';
import { KeyboardShortcutsSettings } from './KeyboardShortcutsSettings';
import { QualitySettingsSection } from './settings/QualitySettingsSection';

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Phase 135.1.1: Callback to open Deploy Gate preview from Quality Settings */
  onOpenDeployPreview?: () => void;
};

type SettingsTab = 'general' | 'shortcuts' | 'quality';

export const SettingsModal: React.FC<Props> = ({ open, onClose, onSaved, onOpenDeployPreview }) => {
  const [form, setForm] = useState<F0DesktopSettings>(() =>
    loadSettingsFromStorage()
  );

  // Phase 119.3: Active tab
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  // Phase 109.5.5: Test connection state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const isArabic = form.locale === 'ar';

  useEffect(() => {
    if (open) {
      setForm(loadSettingsFromStorage());
      setTestResult(null); // Reset test result when modal opens
      setActiveTab('general'); // Reset to general tab
    }
  }, [open]);

  if (!open) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setTestResult(null); // Clear test result when settings change
  };

  const handleSave = () => {
    saveSettingsToStorage(form);
    onSaved();
    onClose();
  };

  // Phase 109.5.5: Test Cloud Connection
  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const config: CloudAgentConfig = {
        apiBase: form.cloudApiBase || 'http://localhost:3030',
        projectId: form.projectId || 'test-project',
        apiKey: form.cloudAuthToken,
      };

      const response = await testCloudAgentConnection(config);

      if (response.ok) {
        setTestResult('success:' + response.result.messages[0]);
      } else {
        setTestResult(`error:${response.errorCode}: ${response.message}`);
      }
    } catch (err: any) {
      setTestResult('error:Error: ' + (err?.message || String(err)));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="f0-modal-backdrop" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="f0-modal f0-modal-wide">
        <h2 className="f0-modal-title">
          {isArabic ? 'إعدادات F0 Desktop' : 'F0 Desktop Settings'}
        </h2>

        {/* Phase 119.3: Tab Navigation */}
        <div className="f0-settings-tabs">
          <button
            className={`f0-settings-tab ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            {isArabic ? 'عام' : 'General'}
          </button>
          <button
            className={`f0-settings-tab ${activeTab === 'shortcuts' ? 'active' : ''}`}
            onClick={() => setActiveTab('shortcuts')}
          >
            {isArabic ? 'الاختصارات' : 'Shortcuts'}
          </button>
          <button
            className={`f0-settings-tab ${activeTab === 'quality' ? 'active' : ''}`}
            onClick={() => setActiveTab('quality')}
          >
            {isArabic ? 'الجودة' : 'Quality'}
          </button>
        </div>

        {/* Tab Content */}
        <div className="f0-settings-content">
          {activeTab === 'general' && (
            <>
              {/* Phase 109.5.4: Agent Mode Selection */}
              <div className="f0-modal-field">
                <label className="f0-modal-label">
                  {isArabic ? 'وضع الوكيل' : 'Agent Mode'}
                </label>
                <select
                  name="agentMode"
                  value={form.agentMode || 'local'}
                  onChange={handleChange}
                  className="f0-input"
                >
                  <option value="local">
                    {isArabic ? 'محلي (OpenAI-compatible API)' : 'Local (OpenAI-compatible API)'}
                  </option>
                  <option value="cloud">
                    {isArabic ? 'سحابي (F0 Cloud Agent)' : 'Cloud (F0 Cloud Agent)'}
                  </option>
                </select>
                <p className="f0-modal-hint">
                  {form.agentMode === 'cloud'
                    ? isArabic
                      ? 'يستخدم F0 Cloud Agent مع سياق المشروع الكامل والذاكرة وإعادة الهيكلة الذكية.'
                      : 'Uses F0 Cloud Agent with full project context, memory, and intelligent refactoring.'
                    : isArabic
                      ? 'يستخدم نقطة نهاية OpenAI-compatible محلية (يتطلب API key).'
                      : 'Uses local OpenAI-compatible endpoint (requires API key).'}
                </p>
              </div>

              {/* Local Mode Settings */}
              {form.agentMode !== 'cloud' && (
                <>
                  <div className="f0-modal-field">
                    <label className="f0-modal-label">
                      {isArabic ? 'رابط الخادم' : 'Backend URL'}
                    </label>
                    <input
                      name="backendUrl"
                      value={form.backendUrl}
                      onChange={handleChange}
                      className="f0-input"
                      placeholder="http://localhost:3030/api/openai_compat/v1"
                    />
                  </div>

                  <div className="f0-modal-field">
                    <label className="f0-modal-label">
                      {isArabic ? 'مفتاح API' : 'API Key'}
                    </label>
                    <input
                      name="apiKey"
                      value={form.apiKey}
                      onChange={handleChange}
                      className="f0-input"
                      placeholder="F0_EXT_API_KEY"
                      type="password"
                    />
                  </div>
                </>
              )}

              {/* Cloud Mode Settings */}
              {form.agentMode === 'cloud' && (
                <>
                  <div className="f0-modal-field">
                    <label className="f0-modal-label">
                      {isArabic ? 'رابط Cloud API' : 'Cloud API Base URL'}
                    </label>
                    <input
                      name="cloudApiBase"
                      value={form.cloudApiBase || 'http://localhost:3030'}
                      onChange={handleChange}
                      className="f0-input"
                      placeholder="http://localhost:3030"
                    />
                    <p className="f0-modal-hint">
                      {isArabic
                        ? 'رابط خادم F0 (مثال: http://localhost:3030 للتطوير المحلي)'
                        : 'The F0 server URL (e.g., http://localhost:3030 for local dev)'}
                    </p>
                  </div>

                  {/* Phase 109.5.5: Cloud Auth Token */}
                  <div className="f0-modal-field">
                    <label className="f0-modal-label">
                      {isArabic ? 'توكن المصادقة' : 'Cloud Auth Token'}
                    </label>
                    <input
                      name="cloudAuthToken"
                      value={form.cloudAuthToken || ''}
                      onChange={handleChange}
                      className="f0-input"
                      placeholder="F0_DESKTOP_API_KEY"
                      type="password"
                    />
                    <p className="f0-modal-hint">
                      {isArabic
                        ? 'مطلوب في الإنتاج. اتركه فارغاً للتطوير المحلي.'
                        : 'Required in production. Leave empty for local development.'}
                    </p>
                  </div>

                  {/* Phase 109.5.5: Test Connection Button */}
                  <div className="f0-modal-field">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={testing}
                      className="f0-btn f0-btn-secondary"
                    >
                      {testing
                        ? isArabic ? 'جاري الاختبار...' : 'Testing...'
                        : isArabic ? 'اختبار الاتصال' : 'Test Cloud Connection'}
                    </button>
                    {testResult && (
                      <p className={`f0-modal-hint ${testResult.startsWith('success:') ? 'f0-test-success' : 'f0-test-error'}`}>
                        {testResult.startsWith('success:') ? '✅ ' : '❌ '}
                        {testResult.replace(/^(success:|error:)/, '')}
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Project ID (shared between modes) */}
              <div className="f0-modal-field">
                <label className="f0-modal-label">
                  {isArabic ? 'معرف المشروع' : 'Project ID'}
                </label>
                <input
                  name="projectId"
                  value={form.projectId || ''}
                  onChange={handleChange}
                  className="f0-input"
                  placeholder="my-f0-project-id"
                />
                <p className="f0-modal-hint">
                  {form.agentMode === 'cloud'
                    ? isArabic
                      ? 'مطلوب لوضع السحابة. يربط هذا المجلد بمشروع F0 الخاص بك.'
                      : 'Required for Cloud mode. Links this folder to your F0 project.'
                    : isArabic
                      ? 'اختياري. يستخدم لتتبع سياق المشروع.'
                      : 'Optional. Used for project context tracking.'}
                </p>
              </div>

              {/* Phase 113.4: Language Selection */}
              <div className="f0-modal-field">
                <label className="f0-modal-label">
                  {isArabic ? 'اللغة' : 'Language'}
                </label>
                <select
                  name="locale"
                  value={form.locale || 'en'}
                  onChange={handleChange}
                  className="f0-input"
                >
                  <option value="en">English</option>
                  <option value="ar">العربية (Arabic)</option>
                </select>
                <p className="f0-modal-hint">
                  {isArabic
                    ? 'اختر لغة واجهة المستخدم والردود من الوكيل'
                    : 'Choose the UI language and agent responses language'}
                </p>
              </div>
            </>
          )}

          {/* Phase 119.3: Shortcuts Tab */}
          {activeTab === 'shortcuts' && (
            <KeyboardShortcutsSettings locale={form.locale || 'en'} />
          )}

          {/* Phase 135.1: Quality Tab */}
          {activeTab === 'quality' && (
            <QualitySettingsSection
              locale={form.locale as 'en' | 'ar' || 'en'}
              onOpenDeployPreview={onOpenDeployPreview ? () => {
                onClose(); // Close settings first
                onOpenDeployPreview();
              } : undefined}
            />
          )}
        </div>

        <div className="f0-modal-actions">
          <button className="f0-btn" onClick={onClose}>
            {isArabic ? 'إلغاء' : 'Cancel'}
          </button>
          <button className="f0-btn f0-btn-primary" onClick={handleSave}>
            {isArabic ? 'حفظ' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
