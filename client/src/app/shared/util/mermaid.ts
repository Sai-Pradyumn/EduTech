/**
 * Lazy mermaid loader + renderer. Mermaid is heavy, so it's dynamically imported on first use
 * (keeps it out of the initial bundle). Reused by the Visual Studio renderer and inline chat
 * diagrams. Returns rendered SVG markup, or throws if the diagram source is invalid.
 */
let initialized = false;
let seq = 0;

type MermaidApi = {
  initialize: (cfg: Record<string, unknown>) => void;
  render: (id: string, code: string) => Promise<{ svg: string }>;
};

async function getMermaid(): Promise<MermaidApi> {
  const mod = (await import('mermaid')).default as unknown as MermaidApi;
  if (!initialized) {
    const dark =
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('dark');
    mod.initialize({
      startOnLoad: false,
      theme: dark ? 'dark' : 'default',
      securityLevel: 'strict',
      fontFamily: 'inherit',
    });
    initialized = true;
  }
  return mod;
}

/** Render mermaid source to SVG. Throws on parse errors (caller shows a fallback). */
export async function renderMermaid(code: string): Promise<string> {
  const mermaid = await getMermaid();
  const id = `mmd-${Date.now()}-${seq++}`;
  const { svg } = await mermaid.render(id, code.trim());
  return svg;
}
