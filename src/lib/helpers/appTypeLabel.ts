type AppType = 'web' | 'mobile' | 'desktop';
type MobileTarget = 'ios' | 'android';
type DesktopTarget = 'mac' | 'windows' | 'linux';

interface ProjectLike {
  appType?: AppType;               // legacy single field
  type?: AppType;                  // even older legacy field
  appTypes?: AppType[] | null;     // new multi-select
  mobileTargets?: MobileTarget[] | null;
  desktopTargets?: DesktopTarget[] | null;
}

/**
 * يبني اللابل المعروض في كل مكان
 * آمن حتى لو الدوك القديم مافيهوش الحقول الجديدة.
 */
export function buildAppTypeLabel(
  locale: string,
  project: ProjectLike | null | undefined
): string {
  if (!project) return locale === 'ar' ? 'ويب' : 'Web';

  // 👇 تأكد إنهم Arrays حتى لو undefined أو قيمة واحدة قديمة
  let appTypes: AppType[] = [];

  if (Array.isArray(project.appTypes)) {
    appTypes = project.appTypes.filter(Boolean) as AppType[];
  } else if (project.appType) {
    appTypes = [project.appType];
  } else if (project.type) {
    appTypes = [project.type];
  }

  // fallback لو مافيش ولا نوع
  if (appTypes.length === 0) {
    appTypes = ['web'];
  }

  const mobileTargets: MobileTarget[] = Array.isArray(project.mobileTargets)
    ? (project.mobileTargets.filter(Boolean) as MobileTarget[])
    : [];

  const desktopTargets: DesktopTarget[] = Array.isArray(project.desktopTargets)
    ? (project.desktopTargets.filter(Boolean) as DesktopTarget[])
    : [];

  const tWeb   = locale === 'ar' ? 'ويب' : 'Web';
  const tMob   = locale === 'ar' ? 'موبايل' : 'Mobile';
  const tDesk  = locale === 'ar' ? 'ديسكتوب' : 'Desktop';

  const tIOS      = 'iOS';
  const tAndroid  = 'Android';
  const tMac      = 'Mac';
  const tWindows  = 'Windows';
  const tLinux    = 'Linux';

  const parts: string[] = [];

  if (appTypes.includes('web')) {
    parts.push(tWeb);
  }

  if (appTypes.includes('mobile')) {
    const sub: string[] = [];
    if (mobileTargets.includes('ios')) sub.push(tIOS);
    if (mobileTargets.includes('android')) sub.push(tAndroid);

    if (sub.length > 0) {
      parts.push(`${tMob} (${sub.join(', ')})`);
    } else {
      parts.push(tMob);
    }
  }

  if (appTypes.includes('desktop')) {
    const sub: string[] = [];
    if (desktopTargets.includes('mac')) sub.push(tMac);
    if (desktopTargets.includes('windows')) sub.push(tWindows);
    if (desktopTargets.includes('linux')) sub.push(tLinux);

    if (sub.length > 0) {
      parts.push(`${tDesk} (${sub.join(', ')})`);
    } else {
      parts.push(tDesk);
    }
  }

  // fallback لو فاضي لأي سبب (مش من المفترض نوصل هنا)
  if (parts.length === 0) {
    return locale === 'ar' ? 'ويب' : 'Web';
  }

  return parts.join(' + ');
}
