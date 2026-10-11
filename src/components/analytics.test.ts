import { describe, expect, it } from 'vitest';
import { codeOf, readSource } from '@/lib/test-support/source-text';

const WRAPPER = readSource(new URL('./analytics.tsx', import.meta.url));
const LAYOUT_CODE = codeOf(new URL('../app/layout.tsx', import.meta.url));

/**
 * The beacon must not carry the address.
 *
 * `/report` keeps the street address in its query string, and Vercel Web
 * Analytics reports `location.href` whenever no parameterised route is
 * supplied — which is the case for `@vercel/analytics/react`, the variant
 * mounted here. So every report pageview was sending the homeowner's address
 * to a third party while the homepage said "We never log your address".
 */
describe('analytics cannot send the address', () => {
  it('strips the query string before the event leaves the browser', () => {
    expect(WRAPPER).toContain('beforeSend');
    expect(WRAPPER).toMatch(/url\.search = ''/);
  });

  it('fails closed when the URL will not parse', () => {
    /*
     * A missing data point costs an operator a number. Sending the URL
     * intact because parsing threw would cost a homeowner their address, so
     * the catch returns null rather than the original event.
     */
    const code = codeOf(new URL('./analytics.tsx', import.meta.url));
    const catchBlock = code.slice(code.indexOf('} catch'));
    expect(catchBlock).toMatch(/return null/);
    expect(catchBlock.slice(0, 120)).not.toMatch(/return event/);
  });

  it('keeps the pageview rather than dropping it', () => {
    // Returning null for every event would close the leak and also blind the
    // operator on the one page that matters most. The count is not sensitive.
    const code = codeOf(new URL('./analytics.tsx', import.meta.url));
    expect(code).toMatch(/return \{ \.\.\.event, url: url\.toString\(\) \}/);
  });

  it('the layout mounts the wrapper, never the package directly', () => {
    /*
     * THE WHOLE FIX IS ONE IMPORT LINE, which is exactly the kind of thing a
     * later edit undoes while tidying. Importing Analytics from the package
     * in the layout restores the defect silently — nothing breaks, nothing
     * looks wrong, and the address starts flowing again.
     */
    expect(LAYOUT_CODE).toContain("from '@/components/analytics'");
    expect(LAYOUT_CODE).not.toContain("from '@vercel/analytics");
  });

  it('is the only place the package is imported', () => {
    // One wrapper, one import. A second mount point would not be covered by
    // the beforeSend above.
    const wrapperImports = (WRAPPER.match(/from '@vercel\/analytics/g) ?? []).length;
    expect(wrapperImports).toBe(1);
  });
});

describe('the address cannot leak through a referrer header either', () => {
  /*
   * A SECOND ESCAPE PATH FROM THE SAME ROOT CAUSE. The address is in
   * /report's URL, and a referrer header carries the current URL outward.
   * Modern browsers default to strict-origin-when-cross-origin and send only
   * the origin; the older default, no-referrer-when-downgrade, sends the full
   * URL on https-to-https. Relying on the browser's default means relying on
   * which browser the homeowner happens to use.
   */
  it('pins the policy rather than inheriting it', () => {
    expect(LAYOUT_CODE).toMatch(/referrer: 'strict-origin-when-cross-origin'/);
  });

  it('is set once, in the root layout, so every page inherits it', () => {
    // A per-page policy would be one more thing to remember on the page that
    // needs it most.
    expect(LAYOUT_CODE.indexOf('referrer:')).toBeGreaterThan(-1);
    expect(LAYOUT_CODE.indexOf('referrer:')).toBeLessThan(LAYOUT_CODE.indexOf('export default'));
  });
});
