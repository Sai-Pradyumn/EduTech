/** Flag-gated lab feature models (Phase 3 · A5 Voice, A8 Fine-Tuning, A9 Agent-graph). */

// A5 — Voice Room
export interface VoiceStatus {
  enabled: boolean;
  provider: string;
}
export interface VoiceTurn {
  sessionId: string;
  text: string;
  speak: { text: string; voice: string; provider: string };
}

// A8 — Fine-Tuning Lab
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export interface FineTuningJob {
  id: string;
  name: string;
  baseModel: string;
  datasetName: string;
  datasetSize: number;
  epochs: number;
  status: JobStatus;
  progress: number;
  metrics: { finalLoss?: number; evalAccuracy?: number };
  errorMessage?: string;
  createdAt: string;
}

// A9 — Agent-graph executor
export interface GraphNodeMeta {
  key: string;
  label: string;
  agentType: string;
}
export interface GraphTemplate {
  name: string;
  title: string;
  description: string;
  nodes: GraphNodeMeta[];
}
export interface GraphStepResult {
  key: string;
  label: string;
  agentType: string;
  summary: string;
}
export interface GraphRun {
  id: string;
  graph: string;
  input: string;
  status: string;
  sessionId?: string;
  latencyMs: number;
  steps: GraphStepResult[];
  createdAt: string;
}
