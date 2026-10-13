import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config.mjs';

/**
 * The Content Security Policy, asserted from the config that actually ships.
 *
 * READ THROUGH `headers()` RATHER THAN MATCHED AS TEXT, so these assertions
 * are about the policy the browser receives. A regex over the file would pass
 * on a directive that had been commented out or moved into a branch.
 */
async function policy(): Promise<string> {
  const headers = await (nextConfig as { headers: () => Promise<unknown[]> }).headers();
  const rules = headers as Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
  const csp = rules
    .flatMap((r) => r.headers)
    .find((h) => h.key.toLowerCase() === 'content-security-policy');
  if (!csp) throw new Error('no Content-Security-Policy header is configured');
  return csp.value;
}

function directive(csp: string, name: string): string | null {
  const found = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `) || d === name);
  return found ?? null;
}

describe('the content security policy', () => {
  it('applies to every path', async () => {
    const headers = await (nextConfig as { headers: () => Promise<unknown[]> }).headers();
    const rules = headers as Array<{ source: string }>;
    expect(rules.some((r) => r.source === '/:path*')).toBe(true);
  });

  it('confines everything to this origin by default', async () => {
    expect(directive(await policy(), 'default-src')).toBe("default-src 'self'");
  });

  it('stops an injected script loading attacker code', async () => {
    /*
     * The realistic value of this policy. It does NOT stop an injected inline
     * <script> executing — see the header in next.config.mjs for why a nonce
     * was not used — but an injected `<script src>` pointing anywhere else is
     * blocked, and that is the usual way injected code gets its payload.
     */
    const script = directive(await policy(), 'script-src');
    expect(script).toBe("script-src 'self' 'unsafe-inline'");
    expect(script).not.toContain('unsafe-eval');
    expect(script).not.toMatch(/https?:/);
    expect(script).not.toContain('*');
  });

  it('allows nothing to be sent to another origin', async () => {
    /*
     * THE DIRECTIVE THAT MATTERS MOST HERE, because /report carries a home
     * address. Even if script ran on this page, connect-src 'self' means it
     * has nowhere to send what it reads. Vercel's analytics beacon is
     * same-origin — /_vercel/insights/view, verified on the live site — so
     * this costs nothing we use.
     */
    const connect = directive(await policy(), 'connect-src');
    expect(connect).toBe("connect-src 'self'");
    expect(connect).not.toMatch(/https?:|\*/);
  });

  it('stops a form being repointed at someone else', async () => {
    // The address is typed into a form. form-action 'self' means it cannot be
    // posted anywhere but here, whatever an injection does to the markup.
    expect(directive(await policy(), 'form-action')).toBe("form-action 'self'");
  });

  it('closes the quieter injection vectors', async () => {
    const csp = await policy();
    // A <base> tag silently repoints every relative URL on the page.
    expect(directive(csp, 'base-uri')).toBe("base-uri 'none'");
    expect(directive(csp, 'object-src')).toBe("object-src 'none'");
    // Matches the X-Frame-Options: DENY already set in vercel.json.
    expect(directive(csp, 'frame-ancestors')).toBe("frame-ancestors 'none'");
  });

  it('permits only the resource types the pages were measured to use', async () => {
    /*
     * MEASURED, NOT COPIED FROM A BOILERPLATE. Every page was inspected live:
     * no external scripts, stylesheets, fonts, images or frames, and no
     * `data:` URIs anywhere — the lot diagram is an inline <svg>, not an
     * image source. `data:` is therefore absent from img-src on purpose. If
     * an inline icon ever needs it, that should be a decision someone makes
     * rather than a permission that was always there.
     */
    const csp = await policy();
    expect(directive(csp, 'img-src')).toBe("img-src 'self'");
    expect(directive(csp, 'font-src')).toBe("font-src 'self'");
    expect(csp).not.toContain('data:');
  });

  it('keeps style inline, because a nonce cannot help there anyway', async () => {
    /*
     * The pages use 61 inline `style` attributes, and CSP nonces do not apply
     * to style attributes at all — only to <style> elements. Injected CSS is
     * also a far smaller problem than injected script.
     */
    expect(directive(await policy(), 'style-src')).toBe("style-src 'self' 'unsafe-inline'");
  });

  it('is defined where it can be tested, not only where it ships', async () => {
    /*
     * The other security headers live in vercel.json, which applies only on
     * Vercel. A CSP defined there cannot be exercised by `next start`, so the
     * first sign it breaks hydration would be in production. This one is in
     * next.config.mjs, which is how it was tested before it shipped.
     */
    expect(typeof (nextConfig as { headers?: unknown }).headers).toBe('function');
  });
});
