import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface PortfolioProject {
  projectId: string;
  title: string;
  caseStudy: string;
  stack: string[];
  highlights: string[];
  githubUrl?: string;
  demoUrl?: string;
  visible: boolean;
}
export interface PortfolioLink { label: string; url: string }
export interface Portfolio {
  username: string;
  title: string;
  tagline: string;
  about: string;
  targetRole: string;
  skills: string[];
  projects: PortfolioProject[];
  links: PortfolioLink[];
  theme: string;
  status: 'draft' | 'published';
  publicSettings: { showProjects: boolean; showCertificates: boolean; showTimeline: boolean; showContact: boolean };
  generatedAt: string | null;
}
export interface PublicPortfolio {
  username: string;
  title: string;
  tagline: string;
  about: string;
  targetRole: string;
  skills: string[];
  projects: PortfolioProject[];
  links: PortfolioLink[];
  theme: string;
  certificates: { id: string; title: string; verificationId: string }[];
  timeline: { title: string; at: string }[];
}

@Injectable({ providedIn: 'root' })
export class PortfolioService {
  private readonly api = inject(ApiService);
  me(): Observable<Portfolio> { return this.api.get<Portfolio>('/portfolio/me'); }
  patch(input: Partial<Portfolio>): Observable<Portfolio> { return this.api.patch<Portfolio>('/portfolio/me', input); }
  generate(): Observable<Portfolio> { return this.api.post<Portfolio>('/portfolio/generate'); }
  publish(): Observable<Portfolio> { return this.api.post<Portfolio>('/portfolio/publish'); }
  unpublish(): Observable<Portfolio> { return this.api.post<Portfolio>('/portfolio/unpublish'); }
  addProject(projectId: string): Observable<Portfolio> { return this.api.post<Portfolio>(`/portfolio/add-project/${projectId}`); }
  public(username: string): Observable<PublicPortfolio> { return this.api.get<PublicPortfolio>(`/portfolio/public/${username}`); }
}
