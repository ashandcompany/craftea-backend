/**
 * Escapes characters that have special meaning in HTML to prevent XSS when
 * user-provided strings are embedded directly in email templates.
 */
export function escapeHtml(value: string | null | undefined): string {
  if (value == null) return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
