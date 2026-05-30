import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../core/services/admin.service';
import { AdminStudentRow } from '../../core/models';

/**
 * Admin Command Center — students roster (A7). Every platform student with goal, skill level
 * and learning health, with a quick search. Read-only; Role.Admin.
 */
@Component({
  selector: 'asta-admin-students',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule],
  template: `
    <input class="input mb-4" style="max-width:320px" placeholder="Search name, email or goal…" [(ngModel)]="query" (ngModelChange)="q.set($event)" />
    <div class="card" style="padding:0;overflow:auto">
      <table>
        <thead><tr><th>Student</th><th>Goal</th><th>Level</th><th>Health</th><th>Readiness</th><th>Quizzes</th><th>Last active</th></tr></thead>
        <tbody>
          @for (s of filtered(); track s.userId) {
            <tr>
              <td>
                <b>{{ s.name }}</b> @if (!s.onboarded) { <span class="flag">new</span> }<br />
                <span class="sub">{{ s.email }}</span>
              </td>
              <td class="sub2">{{ s.goal }}</td>
              <td>{{ s.skillLevel }}</td>
              <td><span class="pill" [style.color]="healthColor(s.health)">{{ s.health }}</span></td>
              <td>{{ s.readiness }}</td>
              <td>{{ s.quizzes }}</td>
              <td class="sub">{{ s.lastActiveAt ? (s.lastActiveAt | date: 'MMM d') : 'never' }}</td>
            </tr>
          } @empty { <tr><td colspan="7" class="empty">No students match.</td></tr> }
        </tbody>
      </table>
    </div>
    <p class="gen">{{ filtered().length }} of {{ all().length }} students</p>
  `,
  styles: [
    `
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th { text-align: left; font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-mute); padding: 12px 14px; border-bottom: 1px solid var(--paper-3); }
      td { padding: 11px 14px; border-bottom: 1px solid var(--paper-2); vertical-align: top; }
      tr:last-child td { border-bottom: none; }
      .sub { font-size: 11px; color: var(--text-mute); }
      .sub2 { font-size: 12px; color: var(--text-soft); max-width: 200px; }
      .flag { font-family: var(--mono); font-size: 9px; text-transform: uppercase; padding: 1px 6px; border-radius: 100px; background: oklch(0.78 0.15 268 / .15); color: var(--peri-deep); }
      .empty { text-align: center; color: var(--text-mute); padding: 28px; }
      .gen { font-size: 11px; font-family: var(--mono); color: var(--text-mute); margin-top: 10px; }
    `,
  ],
})
export class AdminStudentsComponent implements OnInit {
  private readonly api = inject(AdminService);
  readonly all = signal<AdminStudentRow[]>([]);
  readonly q = signal('');
  query = '';

  readonly filtered = computed(() => {
    const needle = this.q().trim().toLowerCase();
    if (!needle) return this.all();
    return this.all().filter((s) => `${s.name} ${s.email} ${s.goal}`.toLowerCase().includes(needle));
  });

  ngOnInit(): void {
    this.api.students().subscribe({ next: (s) => this.all.set(s) });
  }

  healthColor(health: number): string {
    return health >= 60 ? 'var(--green-deep)' : health >= 40 ? 'var(--peri-deep)' : 'var(--coral-deep)';
  }
}
