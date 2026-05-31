import {
  VisualContentFormat,
  VisualType,
} from '../schemas/visual-asset.schema';

/** A renderable graph payload (the primary structured format — rendered natively as SVG client-side). */
export interface VisualGraph {
  layout: 'vertical' | 'radial' | 'layered' | 'horizontal';
  nodes: {
    id: string;
    label: string;
    group?: string;
    kind?: 'root' | 'normal' | 'accent';
  }[];
  edges: { from: string; to: string; label?: string }[];
}

/** The structured shape the VisualExplainer produces (LLM or deterministic fallback). */
export interface GeneratedVisual {
  type: VisualType;
  contentFormat: VisualContentFormat;
  /** Renderable payload: SVG markup, mermaid text, a JSON-stringified VisualGraph, data-URI, or markdown. */
  content: string;
  /** Portable copy form (mermaid) when the primary format is a graph. */
  mermaid: string;
  caption: string;
  howToRead: string;
  thumbnail: string;
  metadata: Record<string, unknown>;
}

export interface VisualGenInput {
  /** The concept/title to explain. */
  concept: string;
  /** Free-form extra instruction. */
  prompt?: string;
  /** Force a visual type; otherwise the explainer picks one. */
  type?: VisualType;
  level?: 'beginner' | 'intermediate' | 'advanced';
}
