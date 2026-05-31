import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export type PassportVisibility = 'private' | 'unlisted' | 'public';
export type VerificationLevel = 'self' | 'ai' | 'system' | 'mentor' | 'certificate';

export interface PassportSkill {
  skill: string;
  mastery: number;
  confidence: number;
  evidenceCount: number;
  lastPracticed: string | null;
  riskLevel: 'low' | 'medium' | 'high';
}
export interface PassportProject {
  id: string;
  title: string;
  stack: string[];
  features: string[];
  difficulty: string;
  status: string;
  aiScore: number | null;
  mentorStatus: 'approved' | 'changes_requested' | 'pending' | null;
  githubUrl: string | null;
  demoUrl: string | null;
}
export interface PassportTimelineItem {
  id: string;
  kind: string;
  title: string;
  detail: string;
  score: number | null;
  verificationLevel: VerificationLevel;
  visibleOnPassport: boolean;
  at: string;
}
export interface PassportPublicSettings {
  showScores: boolean;
  showProjects: boolean;
  showTimeline: boolean;
  showCertificates: boolean;
  verifiedOnly: boolean;
}
export interface PassportEvidence {
  id: string;
  skill: string;
  sourceType: string;
  summary: string;
  score: number | null;
  url: string | null;
  verificationLevel: string;
  visibleOnPassport?: boolean;
}
export interface SkillPassport {
  username: string;
  identity: {
    name: string;
    headline: string;
    targetRole: string;
    currentLevel: string;
    readinessScore: number;
    healthScore: number;
    topSkills: string[];
    pace: string;
    projectedDaysToGoal: number | null;
  };
  skills: PassportSkill[];
  proofSummary: {
    totalEvents: number;
    verifiedEvents: number;
    quizzesPassed: number;
    projectsCompleted: number;
    simulationsPassed: number;
    certificatesIssued: number;
    mentorApprovals: number;
    vivaPassed: number;
    mistakesResolved: number;
  };
  projects: PassportProject[];
  certificates: { id: string; title: string; skill: string; score: number; verificationId: string; issuedAt: string }[];
  manualEvidence: PassportEvidence[];
  timeline: PassportTimelineItem[];
  visibility: PassportVisibility;
  publicSettings: PassportPublicSettings;
  lastComputedAt: string | null;
}

export interface UpdatePassportInput {
  headline?: string;
  targetRole?: string;
  visibility?: PassportVisibility;
  publicSettings?: Partial<PassportPublicSettings>;
}

@Injectable({ providedIn: 'root' })
export class SkillPassportService {
  private readonly api = inject(ApiService);

  me(): Observable<SkillPassport> { return this.api.get<SkillPassport>('/skill-passport/me'); }
  patch(input: UpdatePassportInput): Observable<SkillPassport> { return this.api.patch<SkillPassport>('/skill-passport/me', input); }
  recompute(): Observable<SkillPassport> { return this.api.post<SkillPassport>('/skill-passport/recompute'); }
  publish(): Observable<SkillPassport> { return this.api.post<SkillPassport>('/skill-passport/publish'); }
  unpublish(): Observable<SkillPassport> { return this.api.post<SkillPassport>('/skill-passport/unpublish'); }
  public(username: string): Observable<SkillPassport> { return this.api.get<SkillPassport>(`/skill-passport/public/${username}`); }

  listEvidence(): Observable<PassportEvidence[]> { return this.api.get<PassportEvidence[]>('/skill-passport/evidence'); }
  addEvidence(input: { skill: string; sourceType: string; summary: string; score?: number; url?: string }): Observable<PassportEvidence> {
    return this.api.post<PassportEvidence>('/skill-passport/add-evidence', input);
  }
  removeEvidence(id: string): Observable<{ ok: true }> { return this.api.delete<{ ok: true }>(`/skill-passport/evidence/${id}`); }
}

export const VERIFICATION_META: Record<VerificationLevel, { label: string; glyph: string; tone: string }> = {
  certificate: { label: 'Certificate', glyph: '🏅', tone: 'var(--green)' },
  mentor: { label: 'Mentor-verified', glyph: '👤', tone: 'var(--green)' },
  system: { label: 'System-verified', glyph: '✓', tone: 'var(--peri, #8aa6ff)' },
  ai: { label: 'AI-reviewed', glyph: '🔍', tone: 'var(--peri, #8aa6ff)' },
  self: { label: 'Self-reported', glyph: '•', tone: 'var(--text-mute)' },
};
