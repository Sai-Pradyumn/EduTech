import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export type VisualType =
  | 'flowchart'
  | 'mind_map'
  | 'concept_graph'
  | 'sequence_diagram'
  | 'system_design'
  | 'architecture'
  | 'comparison'
  | 'timeline'
  | 'infographic'
  | 'flashcard'
  | 'memory_palace'
  | 'formula_map'
  | 'process_map'
  | 'cheat_sheet'
  | 'illustration'
  | 'analogy';

export type VisualContentFormat = 'svg' | 'mermaid' | 'jsonGraph' | 'imageUrl' | 'markdown' | 'html';
export type VisualStatus = 'generating' | 'ready' | 'failed';

export interface VisualGraph {
  layout: 'vertical' | 'radial' | 'layered' | 'horizontal';
  nodes: { id: string; label: string; group?: string; kind?: 'root' | 'normal' | 'accent' }[];
  edges: { from: string; to: string; label?: string }[];
}

export interface Visual {
  id: string;
  type: VisualType;
  title: string;
  prompt: string;
  sourceType: string;
  sourceId: string | null;
  sourceNodeId: string | null;
  contentFormat: VisualContentFormat;
  content: string;
  mermaid: string;
  thumbnail: string;
  caption: string;
  howToRead: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  status: VisualStatus;
  provider: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface GenerateVisualRequest {
  concept: string;
  prompt?: string;
  type?: VisualType;
  level?: 'beginner' | 'intermediate' | 'advanced';
  sourceType?: string;
  sourceId?: string;
}

@Injectable({ providedIn: 'root' })
export class VisualService {
  private readonly api = inject(ApiService);

  status(): Observable<{ enabled: boolean; imageGeneration: boolean }> {
    return this.api.get<{ enabled: boolean; imageGeneration: boolean }>('/visuals/status');
  }

  list(): Observable<Visual[]> {
    return this.api.get<Visual[]>('/visuals');
  }

  get(id: string): Observable<Visual> {
    return this.api.get<Visual>(`/visuals/${id}`);
  }

  generate(req: GenerateVisualRequest): Observable<Visual> {
    return this.api.post<Visual>('/visuals/generate', req);
  }

  fromFlowNode(flowId: string, nodeId: string, type?: VisualType): Observable<Visual> {
    return this.api.post<Visual>('/visuals/from-flow-node', { flowId, nodeId, type });
  }

  update(id: string, body: { title?: string; caption?: string }): Observable<Visual> {
    return this.api.patch<Visual>(`/visuals/${id}`, body);
  }

  regenerate(id: string): Observable<Visual> {
    return this.api.post<Visual>(`/visuals/${id}/regenerate`, {});
  }

  remove(id: string): Observable<{ ok: true }> {
    return this.api.delete<{ ok: true }>(`/visuals/${id}`);
  }
}

/** Visual type → display label + glyph (shared by gallery + viewer). */
export const VISUAL_TYPE_META: Record<VisualType, { label: string; glyph: string }> = {
  flowchart: { label: 'Flowchart', glyph: '⤵' },
  mind_map: { label: 'Mind map', glyph: '✺' },
  concept_graph: { label: 'Concept graph', glyph: '◈' },
  sequence_diagram: { label: 'Sequence', glyph: '⇄' },
  system_design: { label: 'System design', glyph: '▤' },
  architecture: { label: 'Architecture', glyph: '▦' },
  comparison: { label: 'Comparison', glyph: '⇆' },
  timeline: { label: 'Timeline', glyph: '⏱' },
  infographic: { label: 'Infographic', glyph: '▥' },
  flashcard: { label: 'Flashcards', glyph: '▭' },
  memory_palace: { label: 'Memory palace', glyph: '◫' },
  formula_map: { label: 'Formula map', glyph: '∑' },
  process_map: { label: 'Process map', glyph: '⇉' },
  cheat_sheet: { label: 'Cheat sheet', glyph: '☰' },
  illustration: { label: 'Illustration', glyph: '✦' },
  analogy: { label: 'Analogy', glyph: '❖' },
};

export const VISUAL_TYPE_LIST: VisualType[] = [
  'mind_map',
  'flowchart',
  'process_map',
  'concept_graph',
  'sequence_diagram',
  'architecture',
  'system_design',
  'comparison',
  'timeline',
  'formula_map',
  'cheat_sheet',
  'flashcard',
  'memory_palace',
  'infographic',
  'illustration',
  'analogy',
];
