// desktop/src/commands/commandPalette.ts
// Phase 114.4: Command Palette Data Types and Commands
// Phase 119.2: Added keyboard shortcuts for Preview operations
// Phase 120: Added Quick Search command
// Phase 128.5.2: Added ACE (Auto Code Evolution) command

export type CommandCategory =
  | 'navigation'
  | 'runner'
  | 'agent'
  | 'view'
  | 'system'
  | 'preview'
  | 'analysis';

export interface CommandItem {
  id: string;
  label: string;
  labelAr: string;
  description?: string;
  descriptionAr?: string;
  category: CommandCategory;
  shortcut?: string;
}

export const COMMANDS: CommandItem[] = [
  {
    id: 'quick-open',
    label: 'Quick Open File',
    labelAr: 'فتح ملف سريع',
    description: 'Fuzzy search and open files instantly.',
    descriptionAr: 'البحث الضبابي وفتح الملفات فوراً.',
    category: 'navigation',
    shortcut: '⌘P',
  },
  {
    id: 'focus-files',
    label: 'Focus Files Panel',
    labelAr: 'التركيز على لوحة الملفات',
    category: 'view',
  },
  {
    id: 'focus-editor',
    label: 'Focus Editor',
    labelAr: 'التركيز على المحرر',
    category: 'view',
  },
  {
    id: 'focus-agent',
    label: 'Focus Agent Panel',
    labelAr: 'التركيز على لوحة الوكيل',
    category: 'view',
  },
  {
    id: 'toggle-runner',
    label: 'Toggle Runner Panel',
    labelAr: 'إظهار/إخفاء لوحة الأوامر (Runner)',
    category: 'runner',
  },
  {
    id: 'run-last-command',
    label: 'Run Last CLI Command',
    labelAr: 'تشغيل آخر أمر CLI',
    category: 'runner',
  },
  {
    id: 'open-settings',
    label: 'Open Settings',
    labelAr: 'فتح الإعدادات',
    category: 'system',
    shortcut: '⌘,',
  },
  {
    id: 'toggle-locale',
    label: 'Switch Language (EN / AR)',
    labelAr: 'تغيير اللغة (عربي / إنجليزي)',
    category: 'system',
  },
  {
    id: 'close-current-tab',
    label: 'Close Current Tab',
    labelAr: 'إغلاق التاب الحالي',
    description: 'Close the currently active editor tab.',
    descriptionAr: 'إغلاق تاب المحرر النشط حالياً.',
    category: 'navigation',
    shortcut: '⌘W',
  },
  {
    id: 'save-file',
    label: 'Save File',
    labelAr: 'حفظ الملف',
    description: 'Save the current file.',
    descriptionAr: 'حفظ الملف الحالي.',
    category: 'navigation',
    shortcut: '⌘S',
  },
  {
    id: 'open-folder',
    label: 'Open Folder',
    labelAr: 'فتح مجلد',
    description: 'Open a folder to start working on a project.',
    descriptionAr: 'فتح مجلد لبدء العمل على مشروع.',
    category: 'navigation',
  },
  {
    id: 'new-agent-chat',
    label: 'New Agent Chat',
    labelAr: 'محادثة جديدة مع الوكيل',
    description: 'Start a new conversation with the AI agent.',
    descriptionAr: 'بدء محادثة جديدة مع الوكيل الذكي.',
    category: 'agent',
  },
  {
    id: 'clear-agent-history',
    label: 'Clear Agent History',
    labelAr: 'مسح سجل الوكيل',
    description: 'Clear the agent conversation history.',
    descriptionAr: 'مسح سجل محادثات الوكيل.',
    category: 'agent',
  },
  // Phase 115.1: Browser Preview Commands
  // Phase 119.2: Added shortcuts for Preview operations
  {
    id: 'toggle-browser-preview',
    label: 'Toggle Browser Preview',
    labelAr: 'إظهار/إخفاء المعاينة المباشرة',
    description: 'Show or hide the live browser preview panel.',
    descriptionAr: 'إظهار أو إخفاء لوحة المعاينة المباشرة.',
    category: 'preview',
    shortcut: '⌘⌥P',
  },
  {
    id: 'refresh-preview',
    label: 'Refresh Preview',
    labelAr: 'تحديث المعاينة',
    description: 'Reload the browser preview.',
    descriptionAr: 'إعادة تحميل المعاينة.',
    category: 'preview',
    shortcut: '⌘R',
  },
  {
    id: 'hard-refresh-preview',
    label: 'Hard Refresh Preview',
    labelAr: 'تحديث كامل للمعاينة',
    description: 'Force reload the browser preview (clear cache).',
    descriptionAr: 'إعادة تحميل كاملة للمعاينة (مسح الكاش).',
    category: 'preview',
    shortcut: '⌘⇧R',
  },
  {
    id: 'cycle-viewport',
    label: 'Cycle Viewport Mode',
    labelAr: 'تغيير وضع العرض',
    description: 'Switch between Full/Desktop/Tablet/Mobile viewport modes.',
    descriptionAr: 'التبديل بين أوضاع العرض المختلفة.',
    category: 'preview',
    shortcut: '⌘⌥M',
  },
  {
    id: 'toggle-preview-logs',
    label: 'Toggle Preview Console',
    labelAr: 'إظهار/إخفاء الكونسول',
    description: 'Show or hide the preview console logs panel.',
    descriptionAr: 'إظهار أو إخفاء لوحة سجلات الكونسول.',
    category: 'preview',
    shortcut: '⌘⌥L',
  },
  // Phase 116.1: Preview Tabs Commands
  {
    id: 'new-preview-tab',
    label: 'New Preview Tab',
    labelAr: 'تاب معاينة جديد',
    description: 'Open a new preview tab.',
    descriptionAr: 'فتح تاب معاينة جديد.',
    category: 'preview',
    shortcut: '⌘⌥T',
  },
  {
    id: 'close-preview-tab',
    label: 'Close Preview Tab',
    labelAr: 'إغلاق تاب المعاينة',
    description: 'Close the active preview tab.',
    descriptionAr: 'إغلاق تاب المعاينة النشط.',
    category: 'preview',
    shortcut: '⌘⌥W',
  },
  {
    id: 'next-preview-tab',
    label: 'Next Preview Tab',
    labelAr: 'التاب التالي',
    description: 'Switch to the next preview tab.',
    descriptionAr: 'الانتقال إلى تاب المعاينة التالي.',
    category: 'preview',
    shortcut: '⌘⌥]',
  },
  {
    id: 'prev-preview-tab',
    label: 'Previous Preview Tab',
    labelAr: 'التاب السابق',
    description: 'Switch to the previous preview tab.',
    descriptionAr: 'الانتقال إلى تاب المعاينة السابق.',
    category: 'preview',
    shortcut: '⌘⌥[',
  },
  // Phase 131.7: QR Code Panel Command
  {
    id: 'show-qr-code',
    label: 'Show QR Code',
    labelAr: 'عرض كود QR',
    description: 'Show QR code to preview on your mobile device.',
    descriptionAr: 'عرض كود QR للمعاينة على جهازك المحمول.',
    category: 'preview',
    shortcut: '⌘⌥Q',
  },
  // Phase 124.8: Project Issues Panel
  {
    id: 'open-project-issues',
    label: 'Scan Project Issues',
    labelAr: 'فحص مشاكل المشروع',
    description: 'Scan entire project for code issues and show results.',
    descriptionAr: 'فحص المشروع بالكامل للكشف عن مشاكل الكود.',
    category: 'view',
    shortcut: '⌘⇧I',
  },
  // Phase 125: Code Health Dashboard
  {
    id: 'open-code-health',
    label: 'Show Code Health Dashboard',
    labelAr: 'عرض لوحة صحة الكود',
    description: 'View code health metrics and improvement history.',
    descriptionAr: 'عرض مقاييس صحة الكود وتاريخ التحسينات.',
    category: 'view',
    shortcut: '⌘⇧H',
  },
  // Phase 126: Intelligent Recommendations
  {
    id: 'open-recommendations',
    label: 'Show AI Recommendations',
    labelAr: 'عرض التوصيات الذكية',
    description: 'View intelligent code health recommendations.',
    descriptionAr: 'عرض توصيات ذكية لتحسين صحة الكود.',
    category: 'view',
    shortcut: '⌘⇧E',
  },
  // Phase 127: Health Alerts
  {
    id: 'open-health-alerts',
    label: 'Show Health Alerts',
    labelAr: 'عرض تنبيهات الصحة',
    description: 'View code health alerts and notifications.',
    descriptionAr: 'عرض تنبيهات وإشعارات صحة الكود.',
    category: 'view',
    shortcut: '⌘⇧A',
  },
  // Phase 128: ACE (Auto Code Evolution)
  {
    id: 'open-ace-panel',
    label: 'Open Auto Code Evolution (ACE)',
    labelAr: 'فتح لوحة تطوير الكود التلقائي (ACE)',
    description: 'View technical debt, evolution plans, and refactoring suggestions.',
    descriptionAr: 'عرض الدين التقني وخطط التطوير واقتراحات إعادة الهيكلة.',
    category: 'analysis',
    shortcut: '⌘⇧X',
  },
  // Phase 130: Auto Test & QA Runner
  {
    id: 'open-tests-panel',
    label: 'Open Tests Panel',
    labelAr: 'فتح لوحة الاختبارات',
    description: 'View and run project tests.',
    descriptionAr: 'عرض وتشغيل اختبارات المشروع.',
    category: 'analysis',
    shortcut: '⌘⇧T',
  },
  {
    id: 'run-all-tests',
    label: 'Run All Tests',
    labelAr: 'تشغيل جميع الاختبارات',
    description: 'Run all test suites in the project.',
    descriptionAr: 'تشغيل جميع مجموعات الاختبار في المشروع.',
    category: 'runner',
  },
  {
    id: 'run-affected-tests',
    label: 'Run Affected Tests',
    labelAr: 'تشغيل الاختبارات المتأثرة',
    description: 'Run tests for recently changed files.',
    descriptionAr: 'تشغيل اختبارات الملفات المعدلة مؤخراً.',
    category: 'runner',
  },
];
