import { sanitizeMarkup } from './sanitize-markup';

describe('sanitizeMarkup', () => {
  it('removes script tags but keeps the drawing', () => {
    const out = sanitizeMarkup('<svg><script>alert(1)</script><circle cx="5"/></svg>');
    expect(out).not.toContain('<script');
    expect(out).toContain('circle');
  });

  it('strips inline event handlers', () => {
    const out = sanitizeMarkup('<svg onload="alert(1)"><a onclick="x()">t</a></svg>');
    expect(out.toLowerCase()).not.toContain('onload');
    expect(out.toLowerCase()).not.toContain('onclick');
  });

  it('drops javascript: hrefs but keeps safe ones', () => {
    const out = sanitizeMarkup(
      '<a href="javascript:alert(1)">x</a><a href="https://ok.dev">y</a>',
    );
    expect(out).not.toContain('javascript:');
    expect(out).toContain('https://ok.dev');
  });

  it('removes foreignObject (HTML-in-SVG injection vector)', () => {
    const out = sanitizeMarkup(
      '<svg><foreignObject><img src=x onerror="alert(1)"></foreignObject><rect/></svg>',
    );
    expect(out.toLowerCase()).not.toContain('foreignobject');
    expect(out).toContain('rect');
  });

  it('returns empty for empty input', () => {
    expect(sanitizeMarkup('')).toBe('');
  });
});
