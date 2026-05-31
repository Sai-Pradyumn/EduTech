import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface CouncilProposal {
  agent: string;
  glyph: string;
  stance: string;
  recommendation: string;
  rationale: string;
  route: string;
  urgency: number;
}
export interface CouncilVerdict {
  members: CouncilProposal[];
  chosen: CouncilProposal;
  synthesis: string;
}

@Injectable({ providedIn: 'root' })
export class MentorCouncilService {
  private readonly api = inject(ApiService);
  convene(): Observable<CouncilVerdict> { return this.api.get<CouncilVerdict>('/mentor-council'); }
  reconvene(): Observable<CouncilVerdict> { return this.api.post<CouncilVerdict>('/mentor-council/convene', {}); }
}
