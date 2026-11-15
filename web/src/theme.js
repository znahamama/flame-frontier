// Chart colors are read from CSS tokens so light/dark are defined in one place (style.css).
export function tokens() {
  const cs = getComputedStyle(document.documentElement);
  const t = (n) => cs.getPropertyValue(n).trim();
  return {
    surface: t('--surface-1'), text: t('--text-primary'), text2: t('--text-secondary'),
    grid: t('--grid'), s1: t('--series-1'), s2: t('--series-2'), s3: t('--series-3'), zone: t('--zone'), pending: t('--pending'), accent: t('--accent'),
  };
}
