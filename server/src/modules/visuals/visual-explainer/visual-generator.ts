import { VisualType } from '../schemas/visual-asset.schema';
import { GeneratedVisual, VisualGenInput, VisualGraph } from './generated-visual.types';

/** Strip a concept down to a short, clean subject phrase. */
function subjectOf(concept: string): string {
  return concept.replace(/^(learn|master|explain|understand|what is|how does|how to)\s+/i, '').replace(/[?.]+$/, '').trim();
}

/** Pick the most useful visual type for a concept when the caller didn't specify one. */
function inferType(concept: string): VisualType {
  const c = concept.toLowerCase();
  if (/\bvs\b|versus|compare|comparison|difference/.test(c)) return 'comparison';
  if (/architecture|system design|microservice|infrastructure/.test(c)) return 'architecture';
  if (/sequence|request|lifecycle|handshake|flow of/.test(c)) return 'sequence_diagram';
  if (/timeline|history|roadmap|days|weeks|schedule/.test(c)) return 'timeline';
  if (/formula|equation|theorem|law of/.test(c)) return 'formula_map';
  if (/flashcard|memorize|recall/.test(c)) return 'flashcard';
  if (/cheat ?sheet|reference|syntax/.test(c)) return 'cheat_sheet';
  if (/process|steps|how to|pipeline|workflow/.test(c)) return 'process_map';
  return 'mind_map';
}

const LAYOUT_FOR: Record<VisualType, VisualGraph['layout'] | null> = {
  flowchart: 'vertical',
  process_map: 'vertical',
  mind_map: 'radial',
  concept_graph: 'radial',
  formula_map: 'radial',
  sequence_diagram: 'horizontal',
  timeline: 'horizontal',
  system_design: 'layered',
  architecture: 'layered',
  comparison: null,
  infographic: null,
  flashcard: null,
  memory_palace: null,
  cheat_sheet: null,
  illustration: null,
  analogy: null,
};

function processSteps(subject: string): string[] {
  return [
    `Understand what ${subject} is`,
    `Break ${subject} into parts`,
    `See a worked example`,
    `Practice actively`,
    `Check against common mistakes`,
    `Teach it back to lock it in`,
  ];
}

function conceptParts(subject: string): string[] {
  return ['Definition', 'Key components', 'A concrete example', 'When to use it', 'Common pitfalls', 'Related concepts'];
}

function esc(s: string): string {
  return s.replace(/"/g, "'").replace(/[\[\]{}()|]/g, ' ').replace(/\s+/g, ' ').trim();
}

function graphToMermaid(type: VisualType, g: VisualGraph, subject: string): string {
  if (type === 'sequence_diagram') {
    const lines = ['sequenceDiagram'];
    for (let i = 0; i < g.nodes.length - 1; i++) {
      lines.push(`  ${g.nodes[i].label.slice(0, 18)}->>+${g.nodes[i + 1].label.slice(0, 18)}: step ${i + 1}`);
    }
    return lines.join('\n');
  }
  if (type === 'timeline') {
    const lines = ['timeline', `  title ${esc(subject)}`];
    g.nodes.forEach((n, i) => lines.push(`  ${i + 1} : ${esc(n.label)}`));
    return lines.join('\n');
  }
  if (type === 'mind_map') {
    const lines = ['mindmap', `  root((${esc(subject)}))`];
    g.nodes.filter((n) => n.kind !== 'root').forEach((n) => lines.push(`    ${esc(n.label)}`));
    return lines.join('\n');
  }
  const dir = g.layout === 'layered' ? 'TD' : g.layout === 'horizontal' ? 'LR' : 'TD';
  const lines = [`flowchart ${dir}`];
  g.edges.forEach((e) => lines.push(`  ${e.from}["${esc(label(g, e.from))}"] --> ${e.to}["${esc(label(g, e.to))}"]`));
  return lines.join('\n');
}

function label(g: VisualGraph, id: string): string {
  return g.nodes.find((n) => n.id === id)?.label ?? id;
}

function makeThumb(title: string, glyph: string, color: string): string {
  const t = esc(title).slice(0, 22);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b0f17"/><stop offset="1" stop-color="#10161f"/></linearGradient></defs><rect width="320" height="180" fill="url(#g)"/><rect x="1" y="1" width="318" height="178" rx="14" fill="none" stroke="${color}" stroke-opacity="0.35"/><text x="24" y="56" font-family="monospace" font-size="40" fill="${color}">${glyph}</text><text x="24" y="120" font-family="sans-serif" font-size="18" fill="#e6edf3">${t}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const TYPE_GLYPH: Record<VisualType, string> = {
  flowchart: '⤵', process_map: '⇉', mind_map: '✺', concept_graph: '◈', formula_map: '∑',
  sequence_diagram: '⇄', timeline: '⏱', system_design: '▤', architecture: '▦', comparison: '⇆',
  infographic: '▥', flashcard: '▭', memory_palace: '◫', cheat_sheet: '☰', illustration: '✦', analogy: '❖',
};

export function illustrationDataUri(subject: string, accent = '#63ef7a'): string {
  const t = esc(subject).slice(0, 26);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><defs><radialGradient id="rg" cx="0.3" cy="0.3" r="0.9"><stop offset="0" stop-color="${accent}" stop-opacity="0.35"/><stop offset="1" stop-color="#0b0f17"/></radialGradient></defs><rect width="640" height="400" fill="url(#rg)"/><circle cx="200" cy="170" r="90" fill="none" stroke="${accent}" stroke-width="2" stroke-opacity="0.7"/><circle cx="430" cy="240" r="60" fill="none" stroke="#8aa6ff" stroke-width="2" stroke-opacity="0.6"/><line x1="200" y1="170" x2="430" y2="240" stroke="${accent}" stroke-opacity="0.5" stroke-width="2"/><text x="40" y="60" font-family="sans-serif" font-size="26" fill="#e6edf3">${t}</text><text x="40" y="360" font-family="monospace" font-size="13" fill="#8b97a7">Asta · generated illustration (mock)</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Build a complete educational visual deterministically. This is the offline/mock fallback for the
 * VisualExplainer — it must produce a valid, renderable visual without any image/LLM API.
 */
export function buildVisual(input: VisualGenInput): GeneratedVisual {
  const subject = subjectOf(input.concept) || 'this concept';
  const type = input.type ?? inferType(input.concept);
  const accent = type === 'comparison' || type === 'analogy' ? '#8aa6ff' : '#63ef7a';
  const thumbnail = makeThumb(input.concept, TYPE_GLYPH[type], accent);
  const baseMeta = { subject, level: input.level ?? 'beginner', generator: 'deterministic' };

  // ── graph-based visuals ──
  const layout = LAYOUT_FOR[type];
  if (layout) {
    let nodes: VisualGraph['nodes'];
    let edges: VisualGraph['edges'] = [];

    if (layout === 'radial') {
      const parts = conceptParts(subject);
      nodes = [{ id: 'c', label: subject, kind: 'root' }, ...parts.map((p, i) => ({ id: `p${i}`, label: p, kind: 'normal' as const }))];
      edges = parts.map((_, i) => ({ from: 'c', to: `p${i}` }));
    } else if (layout === 'layered') {
      const layers = [
        { group: 'Client', items: ['Web / mobile UI'] },
        { group: 'Edge', items: ['Load balancer', 'API gateway'] },
        { group: 'Services', items: [`${subject} service`, 'Auth service'] },
        { group: 'Data', items: ['Database', 'Cache'] },
      ];
      nodes = [];
      edges = [];
      let prevIds: string[] = [];
      layers.forEach((layer, li) => {
        const ids = layer.items.map((it, i) => {
          const id = `l${li}_${i}`;
          nodes.push({ id, label: it, group: layer.group, kind: li === 2 ? 'accent' : 'normal' });
          return id;
        });
        prevIds.forEach((pid) => ids.forEach((id) => edges.push({ from: pid, to: id })));
        prevIds = ids;
      });
    } else {
      // vertical / horizontal chain
      const steps = processSteps(subject);
      nodes = steps.map((s, i) => ({ id: `s${i}`, label: s, kind: i === 0 ? 'accent' : 'normal' }));
      edges = steps.slice(1).map((_, i) => ({ from: `s${i}`, to: `s${i + 1}`, label: `${i + 1}` }));
    }

    const graph: VisualGraph = { layout, nodes, edges };
    return {
      type,
      contentFormat: 'jsonGraph',
      content: JSON.stringify(graph),
      mermaid: graphToMermaid(type, graph, subject),
      caption: `${capitalize(typeLabel(type))} of ${subject}.`,
      howToRead:
        layout === 'radial'
          ? `Start at the centre (${subject}) and read each branch outward — every branch is a facet you should be able to explain.`
          : layout === 'layered'
            ? 'Read top to bottom: each layer depends on the one above it. Requests flow down, data flows back up.'
            : 'Follow the arrows in order — each step builds on the previous one.',
      thumbnail,
      metadata: { ...baseMeta, layout },
    };
  }

  // ── illustration / analogy (mock image) ──
  if (type === 'illustration' || type === 'analogy') {
    return {
      type,
      contentFormat: 'imageUrl',
      content: illustrationDataUri(subject, accent),
      mermaid: '',
      caption: type === 'analogy' ? `An analogy to picture ${subject}.` : `A generated illustration of ${subject}.`,
      howToRead: 'A pictorial aid — use it as a memory hook, not a precise diagram.',
      thumbnail,
      metadata: { ...baseMeta, note: 'mock image provider' },
    };
  }

  // ── markdown-based visuals ──
  let md = '';
  if (type === 'comparison') {
    const pair = subject.split(/\s+vs\.?\s+|\s+versus\s+/i);
    const a = capitalize(pair[0] ?? 'Option A');
    const b = capitalize(pair[1] ?? 'Option B');
    md = `### ${a} vs ${b}\n\n| Aspect | ${a} | ${b} |\n|---|---|---|\n| What it is | … | … |\n| Best for | … | … |\n| Strengths | … | … |\n| Trade-offs | … | … |\n| Use when | … | … |`;
  } else if (type === 'flashcard') {
    const parts = conceptParts(subject);
    md = `### Flashcards · ${capitalize(subject)}\n\n` + parts.map((p, i) => `**Q${i + 1}.** ${p} of ${subject}?\n\n> _Flip to answer_`).join('\n\n');
  } else if (type === 'cheat_sheet') {
    md = `### ${capitalize(subject)} — cheat sheet\n\n- **Core idea:** …\n- **Key terms:** …\n- **Must-know syntax/steps:** …\n- **Gotchas:** …\n- **One-liner to remember:** …`;
  } else if (type === 'memory_palace') {
    md = `### Memory palace · ${capitalize(subject)}\n\nWalk through 5 rooms — place one idea in each:\n\n1. **Front door** — the definition\n2. **Hallway** — the key parts\n3. **Living room** — a vivid example\n4. **Kitchen** — when to use it\n5. **Bedroom** — the common mistake to avoid`;
  } else {
    // infographic / fallback
    md = `### ${capitalize(subject)} at a glance\n\n- **What:** …\n- **Why it matters:** …\n- **How it works:** …\n- **Example:** …\n- **Remember:** …`;
  }
  return {
    type,
    contentFormat: 'markdown',
    content: md,
    mermaid: '',
    caption: `${capitalize(typeLabel(type))} for ${subject}.`,
    howToRead: 'Skim the headings first, then fill the gaps from your notes or by asking the AI Tutor.',
    thumbnail,
    metadata: baseMeta,
  };
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

export function typeLabel(t: VisualType): string {
  return t.replace(/_/g, ' ');
}
