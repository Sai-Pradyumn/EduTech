import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export type FlowNodeType =
  | 'concept'
  | 'prerequisite'
  | 'lesson'
  | 'practice'
  | 'quiz'
  | 'project'
  | 'checkpoint'
  | 'weak_area_repair'
  | 'mentor_review'
  | 'voice_practice'
  | 'simulation'
  | 'document_source'
  | 'diagram'
  | 'image'
  | 'mastery_gate';

export type FlowEdgeRelation =
  | 'prerequisite'
  | 'unlocks'
  | 'reinforces'
  | 'tests'
  | 'depends_on'
  | 'alternative_path'
  | 'weak_area_patch'
  | 'project_application';

export type FlowNodeStatus = 'locked' | 'available' | 'in_progress' | 'completed' | 'skipped';
export type FlowStatus = 'draft' | 'active' | 'completed' | 'archived';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  title: string;
  summary: string;
  objective: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
  masteryScore: number;
  status: FlowNodeStatus;
  position: { x: number; y: number };
  stage: number;
  prerequisites: string[];
  resources: { label: string; url?: string; kind?: string }[];
  agentHints: string[];
  linkedRoadmapId: string | null;
  linkedQuizId: string | null;
  linkedProjectId: string | null;
  linkedKnowledgeDocumentIds: string[];
  linkedVisualAssetIds: string[];
  linkedVoiceSessionIds: string[];
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  relation: FlowEdgeRelation;
  strength: number;
  explanation: string;
}

export interface FlowTimelineBucket {
  index: number;
  label: string;
  focus: string;
  nodeIds: string[];
}

export interface Flow {
  id: string;
  title: string;
  goal: string;
  description: string;
  sourceType: string;
  sourceId: string | null;
  status: FlowStatus;
  difficulty: Difficulty;
  progressPercentage: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
  timeline: FlowTimelineBucket[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateFlowRequest {
  goal: string;
  difficulty?: Difficulty;
  targetRole?: string;
  preferredStack?: string[];
  dailyMinutes?: number;
  timelineWeeks?: number;
  learningStyle?: string;
}

export interface NodeExecution {
  nodeId: string;
  kind: 'tutor' | 'quiz' | 'project' | 'voice' | 'mentor' | 'knowledge' | 'simulation';
  route: string;
  prompt?: string;
  agentType?: string;
}

@Injectable({ providedIn: 'root' })
export class FlowService {
  private readonly api = inject(ApiService);

  status(): Observable<{ enabled: boolean }> {
    return this.api.get<{ enabled: boolean }>('/flows/status');
  }

  list(): Observable<Flow[]> {
    return this.api.get<Flow[]>('/flows');
  }

  get(id: string): Observable<Flow> {
    return this.api.get<Flow>(`/flows/${id}`);
  }

  generate(req: GenerateFlowRequest): Observable<Flow> {
    return this.api.post<Flow>('/flows/generate', req);
  }

  fromRoadmap(roadmapId: string): Observable<Flow> {
    return this.api.post<Flow>(`/flows/from-roadmap/${roadmapId}`, {});
  }

  update(id: string, body: { title?: string; description?: string; status?: FlowStatus }): Observable<Flow> {
    return this.api.patch<Flow>(`/flows/${id}`, body);
  }

  addNode(id: string, body: Partial<FlowNode> & { type: FlowNodeType; title: string }): Observable<Flow> {
    return this.api.post<Flow>(`/flows/${id}/nodes`, body);
  }

  updateNode(id: string, nodeId: string, body: Partial<FlowNode>): Observable<Flow> {
    return this.api.patch<Flow>(`/flows/${id}/nodes/${nodeId}`, body);
  }

  removeNode(id: string, nodeId: string): Observable<Flow> {
    return this.api.delete<Flow>(`/flows/${id}/nodes/${nodeId}`);
  }

  executeNode(id: string, nodeId: string): Observable<{ flow: Flow; execution: NodeExecution }> {
    return this.api.post<{ flow: Flow; execution: NodeExecution }>(`/flows/${id}/execute-node/${nodeId}`, {});
  }

  recalculate(id: string): Observable<Flow> {
    return this.api.post<Flow>(`/flows/${id}/recalculate`, {});
  }

  export(id: string): Observable<Record<string, unknown>> {
    return this.api.post<Record<string, unknown>>(`/flows/${id}/export`, {});
  }

  remove(id: string): Observable<{ ok: true }> {
    return this.api.delete<{ ok: true }>(`/flows/${id}`);
  }
}
