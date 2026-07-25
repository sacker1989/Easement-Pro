/**
 * Shared plain-language letter shape used by every Track 1/2 template
 * (Request for Clarification, Maintenance Request, and future templates).
 * Keeping this shape and its renderer in one place means the format is
 * edited and versioned once, not per-template.
 */
export interface Letter {
  subject: string;
  salutation: string;
  bodyParagraphs: string[];
  closing: string;
  footerDisclaimer: string;
}

export function renderLetterAsPlainText(letter: Letter): string {
  return [
    `Subject: ${letter.subject}`,
    letter.salutation,
    ...letter.bodyParagraphs,
    letter.closing,
    '---',
    letter.footerDisclaimer,
  ].join('\n\n');
}
