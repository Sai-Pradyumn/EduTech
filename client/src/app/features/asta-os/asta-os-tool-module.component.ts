import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { RoadmapService } from '../../core/services/roadmap.service';
import { QuizService } from '../../core/services/quiz.service';
import { MistakeService, Mistake } from '../../core/services/mistake.service';
import { SkillTwinService, SkillTwin } from '../../core/services/skill-twin.service';
import { LedgerService, LedgerSummary, LedgerEntry } from '../../core/services/ledger.service';
import { FlowService, Flow } from '../../core/services/flow.service';
import { VisualService, Visual } from '../../core/services/visual.service';
import { ProjectService } from '../../core/services/project.service';
import { KnowledgeService } from '../../core/services/knowledge.service';
import { SpaceService, StudySpace } from '../../core/services/space.service';
import { InterviewService, InterviewSession } from '../../core/services/interview.service';
import { ResumeService, Resume } from '../../core/services/resume.service';
import { KnowledgeDoc, Project, QuizSummary, Roadmap, RoadmapSummary, SubmitResult, TakeQuiz } from '../../core/models';
import { AstaTool } from './asta-os-tools';

/**
 * Native tool dialog. Renders a fresh, noir Asta OS view for a `panel` tool in a
 * centered, animated modal — built directly on the data services, never the
 * legacy screens. Actions feed back into the Asta session (`ask`) so the learner
 * stays in the cockpit. Closes on scrim click or Esc.
 */
@Component({
  selector: 'asta-os-tool-module',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Scrim click is a mouse convenience; keyboard users close via ESC (document:keydown.escape) or the Close button. -->
    <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
    <div class="scrim" (click)="close.emit()"></div>
    <section class="dialog" role="dialog" aria-modal="true" [attr.aria-label]="tool().label">
      <header class="bar">
        <span class="ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path [attr.d]="tool().icon" /></svg></span>
        <div class="titles"><p class="t">{{ tool().label }}</p><p class="s">{{ tool().blurb }}</p></div>
        <button type="button" class="close" (click)="close.emit()" aria-label="Close">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </header>

      <div class="body scroll">
        @if (loading()) {
          <div class="state"><span class="spin"></span></div>
        } @else {
          @switch (tool().id) {
            @case ('roadmap') {
              @if (openRoadmap(); as r) {
                <button class="back" (click)="openRoadmap.set(null)">← All roadmaps</button>
                <div class="row-top"><span class="name">{{ r.title }}</span><span class="pct">{{ r.progressPercentage }}%</span></div>
                <div class="bar-track"><span class="bar-fill" [style.width.%]="r.progressPercentage"></span></div>
                @for (w of r.weeklyPlan; track w.weekNumber) {
                  <button type="button" class="check wk" [class.on]="weekDone(w.weekNumber)" (click)="toggleWeek(w.weekNumber)">
                    <span class="box">@if (weekDone(w.weekNumber)) { ✓ }</span>
                    <span class="wk-meta"><span class="wk-t">Week {{ w.weekNumber }} · {{ w.title }}</span><span class="wk-f">{{ w.focus }}</span></span>
                  </button>
                }
                <button class="cta" (click)="ask.emit('Continue my roadmap: ' + r.title)">Continue with Asta</button>
              } @else {
                @for (r of roadmaps(); track r.id) {
                  <div class="row">
                    <div class="row-top"><span class="name">{{ r.title }}</span><span class="pct">{{ r.progressPercentage }}%</span></div>
                    <div class="bar-track"><span class="bar-fill" [style.width.%]="r.progressPercentage"></span></div>
                    <p class="meta">{{ r.completedWeeksCount }}/{{ r.totalWeeks }} weeks · {{ r.status }} · {{ r.difficulty }}</p>
                    <button class="go" (click)="openRoadmapDetail(r.id)">Open & track weeks →</button>
                  </div>
                } @empty { <p class="empty">No roadmap yet.</p> }
                <button class="cta" (click)="ask.emit('Build me a learning roadmap')">Build a roadmap</button>
              }
            }
            @case ('quiz') {
              @if (quizResult(); as r) {
                <div class="qz-done">
                  <p class="qz-score" [class.win]="r.evaluation.score >= 70">{{ r.evaluation.correctCount }}/{{ r.evaluation.total }} · {{ r.evaluation.score }}%</p>
                  <p class="meta">{{ r.evaluation.feedback }}</p>
                  <button class="cta" (click)="backToQuizzes()">Back to quizzes</button>
                </div>
              } @else if (playingQuiz()) {
                <p class="kick">{{ playingQuiz()!.title }}</p>
                @for (q of playingQuiz()!.questions; track qi; let qi = $index) {
                  <div class="row tight">
                    <p class="q-prompt">{{ qi + 1 }}. {{ q.prompt }}</p>
                    <div class="opts">
                      @for (o of q.options; track oi; let oi = $index) {
                        <button type="button" class="opt" [class.sel]="quizAnswers()[qi] === oi" (click)="selectAnswer(qi, oi)">{{ o }}</button>
                      }
                    </div>
                  </div>
                }
                <button class="cta" [disabled]="quizBusy()" (click)="submitQuiz(playingQuiz()!)">{{ quizBusy() ? 'Grading…' : 'Submit answers' }}</button>
              } @else {
                @for (q of quizzes(); track q.id) {
                  <div class="row">
                    <div class="row-top"><span class="name">{{ q.title }}</span>@if (q.bestScore !== undefined) { <span class="pct">{{ q.bestScore }}%</span> }</div>
                    <p class="meta">{{ q.topic }} · {{ q.questionCount }} Qs · {{ q.difficulty }}</p>
                    <button class="go" (click)="takeQuiz(q.id)">Take it here →</button>
                  </div>
                } @empty { <p class="empty">No quizzes yet.</p> }
                <button class="cta" (click)="ask.emit('Quiz me on my current topic')">Generate a quiz</button>
              }
            }
            @case ('mistakes') {
              @for (m of mistakes(); track m.id) {
                <div class="row">
                  <div class="row-top"><span class="name">{{ m.concept }}</span><span class="sev" [class.high]="m.severity >= 66">{{ m.severity }}</span></div>
                  <p class="meta">{{ m.mistakeType }} · seen {{ m.frequency }}× · {{ m.status }}</p>
                  @if (m.repairActions.length) {
                    <ul class="checks">
                      @for (a of m.repairActions; track a.id) {
                        <li>
                          <button type="button" class="check" [class.on]="a.done" (click)="toggleRepairAction(m, a.id, !a.done)" [attr.aria-pressed]="a.done">
                            <span class="box">@if (a.done) { ✓ }</span>{{ a.label }}
                          </button>
                        </li>
                      }
                    </ul>
                  }
                  <div class="rowacts">
                    @if (m.status !== 'resolved') { <button class="mini" (click)="resolveMistake(m)">Mark resolved</button> }
                    @if (!m.repairActions.length) { <button class="mini" (click)="repairMistake(m)">Build repair plan</button> }
                    <button class="mini ghost" (click)="ask.emit('Help me repair this weak area: ' + m.concept)">Repair with Asta</button>
                  </div>
                </div>
              } @empty { <p class="empty">No open mistakes — nice.</p> }
            }
            @case ('skill-twin') {
              @if (twin(); as t) {
                <div class="scores">
                  <div class="score"><span class="v">{{ t.readinessScore }}</span><span class="k">readiness</span></div>
                  <div class="score"><span class="v">{{ t.healthScore }}</span><span class="k">health</span></div>
                  <div class="score"><span class="v">{{ t.pace }}</span><span class="k">pace</span></div>
                </div>
                @if (t.headline) { <p class="headline">{{ t.headline }}</p> }
                @for (s of t.skills.slice(0, 6); track s.skill) {
                  <div class="row tight">
                    <div class="row-top"><span class="name">{{ s.skill }}</span><span class="pct">{{ s.mastery }}/{{ s.target }}</span></div>
                    <div class="bar-track"><span class="bar-fill" [style.width.%]="s.target ? (s.mastery / s.target) * 100 : 0"></span></div>
                  </div>
                }
                <button class="cta" (click)="ask.emit('What should I focus on to improve my readiness?')">Ask what to focus on</button>
              } @else { <p class="empty">Not enough data yet — keep learning.</p> }
            }
            @case ('flow') {
              @if (openFlow(); as f) {
                <button class="back" (click)="openFlow.set(null)">← All flows</button>
                <div class="row-top"><span class="name">{{ f.title }}</span><span class="pct">{{ f.progressPercentage }}%</span></div>
                <div class="bar-track"><span class="bar-fill" [style.width.%]="f.progressPercentage"></span></div>
                @for (n of f.nodes; track n.id) {
                  <button type="button" class="check wk" [class.on]="n.status === 'completed'" (click)="toggleNode(n.id, n.status)">
                    <span class="box">@if (n.status === 'completed') { ✓ }</span>
                    <span class="wk-meta"><span class="wk-t">{{ n.title }}</span><span class="wk-f">{{ n.type }} · {{ n.status }}</span></span>
                  </button>
                }
              } @else {
                @for (f of flows(); track f.id) {
                  <div class="row">
                    <div class="row-top"><span class="name">{{ f.title }}</span><span class="pct">{{ f.progressPercentage }}%</span></div>
                    <div class="bar-track"><span class="bar-fill" [style.width.%]="f.progressPercentage"></span></div>
                    <p class="meta">{{ f.nodes.length }} steps · {{ f.status }} · {{ f.difficulty }}</p>
                    <button class="go" (click)="openFlowDetail(f.id)">Open & track steps →</button>
                  </div>
                } @empty { <p class="empty">No learning flows yet.</p> }
                <button class="cta" (click)="ask.emit('Turn my roadmap into a visual learning flow')">Generate a flow</button>
              }
            }
            @case ('visual') {
              @for (v of visuals(); track v.id) {
                <div class="row">
                  <div class="row-top"><span class="name">{{ v.title }}</span><span class="tagk">{{ v.type }}</span></div>
                  <p class="meta">{{ v.prompt }}</p>
                </div>
              } @empty { <p class="empty">No visuals yet.</p> }
              <div class="addrow">
                <input class="inp" [value]="draftA()" (input)="draftA.set($any($event.target).value)" (keydown.enter)="generateVisual()" placeholder="Concept to visualize…" />
                <button class="mini" [disabled]="acting()" (click)="generateVisual()">{{ acting() ? '…' : 'Generate' }}</button>
              </div>
            }
            @case ('project') {
              @if (openProject(); as p) {
                <button class="back" (click)="openProject.set(null)">← All projects</button>
                <p class="kick">{{ p.title }}</p>
                @for (t of p.tasks; track t.id) {
                  <div class="row tight">
                    <p class="q-prompt">{{ t.title }}</p>
                    <div class="seg3">
                      <button type="button" [class.on]="t.status === 'todo'" (click)="moveTask(t.id, 'todo')">To do</button>
                      <button type="button" [class.on]="t.status === 'in_progress'" (click)="moveTask(t.id, 'in_progress')">Doing</button>
                      <button type="button" [class.on]="t.status === 'done'" (click)="moveTask(t.id, 'done')">Done</button>
                    </div>
                  </div>
                } @empty { <p class="empty">No tasks yet.</p> }
                <div class="addrow">
                  <input class="inp" [value]="draftB()" (input)="draftB.set($any($event.target).value)" (keydown.enter)="addTask()" placeholder="Add a task…" />
                  <button class="mini" (click)="addTask()">Add</button>
                </div>
              } @else {
                @for (p of projects(); track p.id) {
                  <div class="row">
                    <div class="row-top"><span class="name">{{ p.title }}</span><span class="tagk">{{ p.status }}</span></div>
                    <p class="meta">{{ p.difficulty }} · ~{{ p.estimatedWeeks }} wks · {{ p.techStack.slice(0, 3).join(', ') }}</p>
                    <button class="go" (click)="openProjectDetail(p.id)">Open task board →</button>
                  </div>
                } @empty { <p class="empty">No projects yet.</p> }
                <button class="cta" (click)="ask.emit('Suggest a project to build for my goal')">Plan a project</button>
              }
            }
            @case ('knowledge') {
              @for (d of docs(); track d.id) {
                <div class="row">
                  <div class="row-top"><span class="name">{{ d.title }}</span>
                    <button type="button" class="x" (click)="removeDoc(d.id)" aria-label="Remove source">
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <p class="meta">{{ d.chunkCount }} chunks · {{ d.status }}{{ d.topic ? ' · ' + d.topic : '' }}</p>
                </div>
              } @empty { <p class="empty">No sources yet — add notes to ground Asta’s answers.</p> }
              <div class="addcol">
                <input class="inp" [value]="draftB()" (input)="draftB.set($any($event.target).value)" placeholder="Title (optional)" />
                <textarea class="ta" rows="3" [value]="draftA()" (input)="draftA.set($any($event.target).value)" placeholder="Paste notes to add as a source…"></textarea>
                <div class="rowacts">
                  <button class="mini" [disabled]="acting()" (click)="addNote()">{{ acting() ? 'Adding…' : 'Add source' }}</button>
                  <button class="mini ghost" (click)="ask.emit('Answer using only my uploaded notes')">Ask grounded</button>
                </div>
              </div>
            }
            @case ('spaces') {
              @for (s of spaces(); track s.id) {
                <div class="row">
                  <div class="row-top"><span class="name">{{ s.title }}</span><span class="tagk">{{ s.sources.length }} sources</span></div>
                  @if (s.description) { <p class="meta">{{ s.description }}</p> }
                  <button class="go" (click)="ask.emit('Study with me in my space: ' + s.title)">Study with Asta →</button>
                </div>
              } @empty { <p class="empty">No study spaces yet.</p> }
              <div class="addrow">
                <input class="inp" [value]="draftA()" (input)="draftA.set($any($event.target).value)" (keydown.enter)="createSpace()" placeholder="New space title…" />
                <button class="mini" [disabled]="acting()" (click)="createSpace()">{{ acting() ? '…' : 'Create' }}</button>
              </div>
            }
            @case ('interview') {
              @if (interviewSession(); as s) {
                <button class="back" (click)="interviewSession.set(null)">← Interviews</button>
                @if (s.status === 'finished') {
                  <div class="qz-done">
                    <p class="qz-score" [class.win]="s.technicalScore >= 70">Tech {{ s.technicalScore }} · Comms {{ s.communicationScore }}</p>
                    <p class="meta">{{ s.typeLabel }} · {{ s.total }} questions answered</p>
                    <button class="cta" (click)="interviewSession.set(null)">Done</button>
                  </div>
                } @else {
                  <p class="kick">Question {{ s.currentIndex + 1 }} / {{ s.total }}</p>
                  <p class="q-prompt">{{ currentQuestion() }}</p>
                  <textarea class="ta" rows="4" [value]="draftA()" (input)="draftA.set($any($event.target).value)" placeholder="Type your answer…"></textarea>
                  <div class="rowacts">
                    <button class="mini" [disabled]="acting()" (click)="answerInterview()">{{ acting() ? '…' : 'Submit answer' }}</button>
                    <button class="mini ghost" [disabled]="acting()" (click)="finishInterview()">Finish</button>
                  </div>
                }
              } @else {
                @for (s of interviews(); track s.id) {
                  <div class="row">
                    <div class="row-top"><span class="name">{{ s.typeLabel }} · {{ s.role }}</span><span class="tagk">{{ s.status }}</span></div>
                    <p class="meta">tech {{ s.technicalScore }} · comms {{ s.communicationScore }} · {{ s.total }} Qs</p>
                  </div>
                } @empty { <p class="empty">No interviews yet.</p> }
                <button class="cta" [disabled]="acting()" (click)="startInterview()">{{ acting() ? 'Starting…' : 'Start a mock interview' }}</button>
              }
            }
            @case ('resume') {
              @if (resume(); as r) {
                <div class="row">
                  <div class="row-top"><span class="name">{{ r.headline || 'Your resume' }}</span></div>
                  @if (r.summary) { <p class="meta">{{ r.summary }}</p> }
                  @if (r.skills.length) { <div class="chips">@for (s of r.skills.slice(0, 14); track s) { <span class="chip">{{ s }}</span> }</div> }
                </div>
              } @else { <p class="empty">No resume yet — generate one from your learning so far.</p> }
              <div class="rowacts">
                <button class="cta" [disabled]="acting()" (click)="generateResume()">{{ acting() ? 'Generating…' : (resume() ? 'Regenerate' : 'Generate resume') }}</button>
                <button class="mini ghost" (click)="ask.emit('Help me improve my resume for my target role')">Improve with Asta</button>
              </div>
            }
            @case ('proof') {
              @if (proof(); as p) {
                <div class="scores">
                  <div class="score"><span class="v">{{ p.total }}</span><span class="k">events</span></div>
                  <div class="score"><span class="v">{{ p.verifiedCount }}</span><span class="k">verified</span></div>
                  <div class="score"><span class="v">{{ p.activeDays }}</span><span class="k">active days</span></div>
                </div>
                @if (p.skills.length) {
                  <p class="kick">Proven skills</p>
                  <div class="chips">@for (s of p.skills.slice(0, 12); track s.skill) { <span class="chip">{{ s.skill }} · {{ s.count }}</span> }</div>
                } @else { <p class="empty">Earn proof by solving practice and passing quizzes.</p> }
                @if (proofEntries().length) {
                  <p class="kick">Recent proof · tap the eye to show/hide on your passport</p>
                  @for (e of proofEntries().slice(0, 12); track e.id) {
                    <div class="row tight">
                      <div class="row-top">
                        <span class="name">{{ e.title }}</span>
                        <button type="button" class="eye" [class.on]="e.visibleOnPassport" (click)="toggleProofVisibility(e)" [attr.aria-pressed]="e.visibleOnPassport" aria-label="Toggle passport visibility">
                          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                        </button>
                      </div>
                      <p class="meta">{{ e.kind }} · {{ e.verificationLevel }}</p>
                    </div>
                  }
                }
                <button class="cta" (click)="ask.emit('How do I strengthen my proof of skills for my goal?')">Ask how to strengthen it</button>
              } @else { <p class="empty">No proof recorded yet.</p> }
            }
          }
        }
      </div>
    </section>
  `,
  styles: [
    `
      :host { position: fixed; inset: 0; z-index: 80; display: block; }
      .scrim { position: absolute; inset: 0; background: rgba(2,5,4,.66); backdrop-filter: blur(6px); animation: fade .2s ease; }
      .dialog { position: absolute; inset: 0; margin: auto; width: min(620px, 94vw); max-height: min(80vh, 720px); height: fit-content; display: flex; flex-direction: column; border-radius: 20px; overflow: hidden; background: var(--asta-bg-soft); border: 1px solid var(--asta-border); box-shadow: 0 40px 120px rgba(0,0,0,.6); animation: pop .26s cubic-bezier(.2,.8,.2,1); }
      @keyframes fade { from { opacity: 0; } }
      @keyframes pop { from { opacity: 0; transform: translateY(12px) scale(.97); } }
      @media (prefers-reduced-motion: reduce) { .scrim, .dialog { animation: none; } }

      .bar { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-bottom: 1px solid var(--asta-border); background: var(--asta-bg-elevated); }
      .ic { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; color: var(--asta-green); background: color-mix(in srgb, var(--asta-green) 12%, transparent); }
      .titles { flex: 1; min-width: 0; }
      .t { font-family: var(--display); font-size: 16px; font-weight: 600; }
      .s { font-size: 11.5px; color: var(--asta-muted); }
      .close { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 10px; color: var(--asta-muted); }
      .close:hover { color: var(--asta-coral); background: var(--asta-panel); }

      .body { flex: 1; min-height: 0; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
      .state { display: grid; place-items: center; height: 60%; }
      .spin { width: 26px; height: 26px; border-radius: 999px; border: 2px solid var(--asta-border); border-top-color: var(--asta-green); animation: spin .8s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .spin { animation: none; } }

      .row { padding: 13px 14px; border-radius: 14px; background: var(--asta-panel); border: 1px solid var(--asta-border); }
      .row.tight { padding: 10px 12px; }
      .row-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .name { font-size: 14px; font-weight: 600; }
      .pct { font-family: var(--mono); font-size: 12px; color: var(--asta-green); }
      .tagk { font-family: var(--mono); font-size: 11px; color: var(--asta-cyan); text-transform: capitalize; }
      .sev { font-family: var(--mono); font-size: 12px; color: var(--asta-gold); }
      .sev.high { color: var(--asta-coral); }
      .meta { font-size: 12px; color: var(--asta-muted); margin: 6px 0 0; line-height: 1.45; }
      .bar-track { height: 6px; border-radius: 999px; background: var(--asta-panel-strong); margin: 8px 0 0; overflow: hidden; }
      .bar-fill { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--asta-green-deep), var(--asta-green)); }
      .go { margin-top: 10px; font-size: 12.5px; font-weight: 600; color: var(--asta-green); }
      .go:hover { text-decoration: underline; }

      .scores { display: flex; gap: 10px; }
      .score { flex: 1; padding: 12px; border-radius: 14px; background: var(--asta-panel); border: 1px solid var(--asta-border); text-align: center; }
      .score .v { display: block; font-family: var(--display); font-size: 22px; font-weight: 600; text-transform: capitalize; }
      .score .k { font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em; color: var(--asta-muted); }
      .headline { font-size: 13.5px; color: var(--asta-muted); line-height: 1.5; }

      .kick { font-family: var(--mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: .06em; color: var(--asta-subtle); }
      .chips { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 8px; }
      .chip { font-size: 12px; padding: 5px 11px; border-radius: 999px; border: 1px solid var(--asta-border); background: var(--asta-panel); color: var(--asta-text); }
      .empty { font-size: 13px; color: var(--asta-muted); line-height: 1.55; }
      .cta { margin-top: 4px; align-self: flex-start; font-size: 13px; font-weight: 600; color: #06100a; background: linear-gradient(135deg, var(--asta-green), var(--asta-green-deep)); padding: 9px 16px; border-radius: 999px; }
      .cta:disabled { opacity: .6; cursor: default; }

      .q-prompt { font-size: 13.5px; font-weight: 600; color: var(--asta-text); }
      .opts { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
      .opt { text-align: left; font-size: 13px; color: var(--asta-muted); padding: 8px 11px; border-radius: 10px; border: 1px solid var(--asta-border); background: var(--asta-bg-soft); transition: border-color .14s ease, color .14s ease, background .14s ease; }
      .opt:hover { color: var(--asta-text); }
      .opt.sel { color: var(--asta-text); border-color: color-mix(in srgb, var(--asta-green) 55%, transparent); background: color-mix(in srgb, var(--asta-green) 12%, transparent); }
      .qz-done { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
      .qz-score { font-family: var(--display); font-size: 26px; font-weight: 600; color: var(--asta-coral); }
      .qz-score.win { color: var(--asta-green); }

      .back { align-self: flex-start; font-size: 12px; color: var(--asta-muted); padding: 4px 0; }
      .back:hover { color: var(--asta-text); }
      .rowacts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
      .mini { font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 999px; border: 1px solid var(--asta-border); color: var(--asta-text); }
      .mini.ghost { color: var(--asta-muted); }
      .mini:hover:not(:disabled) { border-color: color-mix(in srgb, var(--asta-green) 45%, transparent); }
      .mini:disabled { opacity: .6; cursor: default; }
      .checks { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
      .check { display: flex; align-items: center; gap: 9px; width: 100%; text-align: left; font-size: 13px; color: var(--asta-muted); padding: 7px 0; }
      .check.on { color: var(--asta-text); }
      .check .box { display: grid; place-items: center; width: 18px; height: 18px; flex-shrink: 0; border-radius: 6px; border: 1.5px solid var(--asta-border); color: #06100a; font-size: 12px; font-weight: 700; }
      .check.on .box { background: var(--asta-green); border-color: var(--asta-green); }
      .check.wk { padding: 9px 11px; border-radius: 12px; border: 1px solid var(--asta-border); background: var(--asta-panel); margin-top: 6px; }
      .check.wk.on { border-color: color-mix(in srgb, var(--asta-green) 40%, transparent); }
      .wk-meta { display: flex; flex-direction: column; line-height: 1.3; }
      .wk-t { font-weight: 600; color: var(--asta-text); font-size: 13px; }
      .wk-f { font-size: 11.5px; color: var(--asta-muted); }
      .seg3 { display: inline-flex; gap: 2px; margin-top: 8px; padding: 2px; border-radius: 999px; background: var(--asta-bg-soft); border: 1px solid var(--asta-border); }
      .seg3 button { font-size: 11.5px; padding: 4px 11px; border-radius: 999px; color: var(--asta-muted); }
      .seg3 button.on { color: #06100a; background: linear-gradient(135deg, var(--asta-green), var(--asta-green-deep)); }
      .addrow { display: flex; gap: 8px; margin-top: 6px; }
      .addcol { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
      .inp { flex: 1; font-size: 13px; color: var(--asta-text); background: var(--asta-bg-soft); border: 1px solid var(--asta-border); border-radius: 10px; padding: 8px 11px; outline: none; }
      .inp:focus, .ta:focus { border-color: color-mix(in srgb, var(--asta-green) 50%, transparent); }
      .ta { width: 100%; resize: vertical; font-family: inherit; font-size: 13px; color: var(--asta-text); background: var(--asta-bg-soft); border: 1px solid var(--asta-border); border-radius: 10px; padding: 8px 11px; outline: none; }
      .x, .eye { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 999px; color: var(--asta-subtle); flex-shrink: 0; }
      .x:hover { color: var(--asta-coral); }
      .eye.on { color: var(--asta-green); }
    `,
  ],
})
export class AstaOsToolModuleComponent {
  private readonly roadmapApi = inject(RoadmapService);
  private readonly quizApi = inject(QuizService);
  private readonly mistakeApi = inject(MistakeService);
  private readonly twinApi = inject(SkillTwinService);
  private readonly ledgerApi = inject(LedgerService);
  private readonly flowApi = inject(FlowService);
  private readonly visualApi = inject(VisualService);
  private readonly projectApi = inject(ProjectService);
  private readonly knowledgeApi = inject(KnowledgeService);
  private readonly spaceApi = inject(SpaceService);
  private readonly interviewApi = inject(InterviewService);
  private readonly resumeApi = inject(ResumeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly tool = input.required<AstaTool>();
  readonly close = output<void>();
  readonly ask = output<string>();

  protected readonly loading = signal(true);
  protected readonly roadmaps = signal<RoadmapSummary[]>([]);
  protected readonly quizzes = signal<QuizSummary[]>([]);
  protected readonly mistakes = signal<Mistake[]>([]);
  protected readonly twin = signal<SkillTwin | null>(null);
  protected readonly proof = signal<LedgerSummary | null>(null);
  protected readonly proofEntries = signal<LedgerEntry[]>([]);
  protected readonly flows = signal<Flow[]>([]);
  protected readonly visuals = signal<Visual[]>([]);
  protected readonly projects = signal<Project[]>([]);
  protected readonly docs = signal<KnowledgeDoc[]>([]);
  protected readonly spaces = signal<StudySpace[]>([]);
  protected readonly interviews = signal<InterviewSession[]>([]);
  protected readonly resume = signal<Resume | null>(null);

  // Inline playable quiz
  protected readonly playingQuiz = signal<TakeQuiz | null>(null);
  protected readonly quizAnswers = signal<Record<number, number>>({});
  protected readonly quizResult = signal<SubmitResult | null>(null);
  protected readonly quizBusy = signal(false);

  // Deep interactions (detail views + inputs)
  protected readonly openRoadmap = signal<Roadmap | null>(null);
  protected readonly openFlow = signal<Flow | null>(null);
  protected readonly openProject = signal<Project | null>(null);
  protected readonly interviewSession = signal<InterviewSession | null>(null);
  protected readonly acting = signal(false);
  protected readonly draftA = signal(''); // shared single-line draft (note text / answer / concept / title)
  protected readonly draftB = signal(''); // secondary draft (note title / new task)

  constructor() {
    effect(
      () => {
        const id = this.tool().id;
        this.loading.set(true);
        this.playingQuiz.set(null);
        this.quizResult.set(null);
        this.quizAnswers.set({});
        this.openRoadmap.set(null);
        this.openFlow.set(null);
        this.openProject.set(null);
        this.interviewSession.set(null);
        this.draftA.set('');
        this.draftB.set('');
        this.fetch(id);
      },
      { allowSignalWrites: true },
    );
  }

  private fetch(id: string): void {
    switch (id) {
      case 'roadmap': return this.load(this.roadmapApi.getMine(), this.roadmaps);
      case 'quiz': return this.load(this.quizApi.list(), this.quizzes);
      case 'mistakes': return this.load(this.mistakeApi.list(), this.mistakes);
      case 'skill-twin': return this.loadOne(this.twinApi.get(), this.twin);
      case 'proof':
        this.ledgerApi.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (e) => this.proofEntries.set(e), error: () => undefined });
        return this.loadOne(this.ledgerApi.summary(), this.proof);
      case 'flow': return this.load(this.flowApi.list(), this.flows);
      case 'visual': return this.load(this.visualApi.list(), this.visuals);
      case 'project': return this.load(this.projectApi.list(), this.projects);
      case 'knowledge': return this.load(this.knowledgeApi.list(), this.docs);
      case 'spaces': return this.load(this.spaceApi.list(), this.spaces);
      case 'interview': return this.load(this.interviewApi.sessions(), this.interviews);
      case 'resume': return this.loadOne(this.resumeApi.me(), this.resume);
      default: this.loading.set(false);
    }
  }

  private load<T>(obs: Observable<T[]>, target: { set: (v: T[]) => void }): void {
    obs.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (v) => { target.set(v); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
  private loadOne<T>(obs: Observable<T>, target: { set: (v: T) => void }): void {
    obs.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (v) => { target.set(v); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  // ── inline playable quiz ──
  protected takeQuiz(id: string): void {
    this.quizApi
      .take(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (q) => { this.playingQuiz.set(q); this.quizAnswers.set({}); }, error: () => undefined });
  }

  protected selectAnswer(questionIndex: number, answerIndex: number): void {
    this.quizAnswers.update((a) => ({ ...a, [questionIndex]: answerIndex }));
  }

  protected submitQuiz(quiz: TakeQuiz): void {
    if (this.quizBusy()) return;
    this.quizBusy.set(true);
    const answers = this.quizAnswers();
    const payload = quiz.questions.map((_, i) => ({ questionIndex: i, answerIndex: answers[i] }));
    this.quizApi
      .submit(quiz.id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => { this.quizResult.set(r); this.playingQuiz.set(null); this.quizBusy.set(false); },
        error: () => this.quizBusy.set(false),
      });
  }

  protected backToQuizzes(): void {
    this.quizResult.set(null);
    this.quizAnswers.set({});
  }

  protected toggleProofVisibility(e: LedgerEntry): void {
    this.ledgerApi.setVisibility(e.id, !e.visibleOnPassport).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.proofEntries.update((es) => es.map((x) => (x.id === e.id ? { ...x, visibleOnPassport: !x.visibleOnPassport } : x))),
      error: () => undefined,
    });
  }

  // ── Mistakes ──
  protected resolveMistake(m: Mistake): void {
    this.mistakeApi.setStatus(m.id, 'resolved').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.load(this.mistakeApi.list(), this.mistakes),
      error: () => undefined,
    });
  }
  protected repairMistake(m: Mistake): void {
    this.mistakeApi.repair(m.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => this.mistakes.update((ms) => ms.map((x) => (x.id === updated.id ? updated : x))),
      error: () => undefined,
    });
  }
  protected toggleRepairAction(m: Mistake, actionId: string, done: boolean): void {
    this.mistakeApi.toggleAction(m.id, actionId, done).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => this.mistakes.update((ms) => ms.map((x) => (x.id === updated.id ? updated : x))),
      error: () => undefined,
    });
  }

  // ── Roadmap ──
  protected openRoadmapDetail(id: string): void {
    this.roadmapApi.getById(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (r) => this.openRoadmap.set(r), error: () => undefined });
  }
  protected weekDone(week: number): boolean {
    return this.openRoadmap()?.completedWeeks.includes(week) ?? false;
  }
  protected toggleWeek(week: number): void {
    const r = this.openRoadmap();
    if (!r) return;
    this.roadmapApi
      .updateProgress(r.id, { weekNumber: week, weekCompleted: !this.weekDone(week) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (updated) => this.openRoadmap.set(updated), error: () => undefined });
  }

  // ── Flow ──
  protected openFlowDetail(id: string): void {
    this.flowApi.get(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (f) => this.openFlow.set(f), error: () => undefined });
  }
  protected toggleNode(nodeId: string, current: string): void {
    const f = this.openFlow();
    if (!f) return;
    const status = current === 'completed' ? 'available' : 'completed';
    this.flowApi.updateNode(f.id, nodeId, { status }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (updated) => this.openFlow.set(updated), error: () => undefined });
  }

  // ── Project ──
  protected openProjectDetail(id: string): void {
    this.projectApi.get(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (p) => this.openProject.set(p), error: () => undefined });
  }
  protected moveTask(taskId: string, status: 'todo' | 'in_progress' | 'done'): void {
    const p = this.openProject();
    if (!p) return;
    this.projectApi.moveTask(p.id, taskId, status).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (updated) => this.openProject.set(updated), error: () => undefined });
  }
  protected addTask(): void {
    const p = this.openProject();
    const title = this.draftB().trim();
    if (!p || !title) return;
    this.projectApi.addTask(p.id, title).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => { this.openProject.set(updated); this.draftB.set(''); },
      error: () => undefined,
    });
  }

  // ── Interview ──
  protected startInterview(): void {
    if (this.acting()) return;
    this.acting.set(true);
    this.interviewApi.start('technical').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (s) => { this.interviewSession.set(s); this.acting.set(false); },
      error: () => this.acting.set(false),
    });
  }
  protected answerInterview(): void {
    const s = this.interviewSession();
    const answer = this.draftA().trim();
    if (!s || !answer || this.acting()) return;
    this.acting.set(true);
    this.interviewApi.respond(s.id, answer).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => { this.interviewSession.set(updated); this.draftA.set(''); this.acting.set(false); },
      error: () => this.acting.set(false),
    });
  }
  protected finishInterview(): void {
    const s = this.interviewSession();
    if (!s || this.acting()) return;
    this.acting.set(true);
    this.interviewApi.finish(s.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => { this.interviewSession.set(updated); this.acting.set(false); },
      error: () => this.acting.set(false),
    });
  }
  protected currentQuestion(): string {
    const s = this.interviewSession();
    if (!s) return '';
    return s.questions[s.currentIndex]?.question ?? '';
  }

  // ── Knowledge ──
  protected addNote(): void {
    const text = this.draftA().trim();
    if (!text || this.acting()) return;
    this.acting.set(true);
    const title = this.draftB().trim() || 'Note';
    this.knowledgeApi.uploadText(title, text).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.draftA.set(''); this.draftB.set(''); this.acting.set(false); this.load(this.knowledgeApi.list(), this.docs); },
      error: () => this.acting.set(false),
    });
  }
  protected removeDoc(id: string): void {
    this.knowledgeApi.remove(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.docs.update((d) => d.filter((x) => x.id !== id)),
      error: () => undefined,
    });
  }

  // ── Visual ──
  protected generateVisual(): void {
    const concept = this.draftA().trim();
    if (!concept || this.acting()) return;
    this.acting.set(true);
    this.visualApi.generate({ concept }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (v) => { this.visuals.update((vs) => [v, ...vs]); this.draftA.set(''); this.acting.set(false); },
      error: () => this.acting.set(false),
    });
  }

  // ── Spaces ──
  protected createSpace(): void {
    const title = this.draftA().trim();
    if (!title || this.acting()) return;
    this.acting.set(true);
    this.spaceApi.create({ title }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (s) => { this.spaces.update((ss) => [s, ...ss]); this.draftA.set(''); this.acting.set(false); },
      error: () => this.acting.set(false),
    });
  }

  // ── Resume ──
  protected generateResume(): void {
    if (this.acting()) return;
    this.acting.set(true);
    this.resumeApi.generate().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => { this.resume.set(r); this.acting.set(false); },
      error: () => this.acting.set(false),
    });
  }

  @HostListener('document:keydown.escape')
  protected onEsc(): void {
    this.close.emit();
  }
}
