import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AgentService } from '../../../core/services/agent.service';
import { PracticeService } from '../../../core/services/practice.service';
import { ToastService } from '../../../core/services/toast.service';
import { CodeRunResult, CodeValidationResult, LanguageInfo, PracticeProblem, PracticeRunRecord, RunKind, SavedSnippet, SupportedLanguage } from '../../../core/models';
import { CodeHandoffService } from '../../../core/services/code-handoff.service';
import { MarkdownPipe } from '../../../shared/pipes/markdown.pipe';
import { AstaOsOrbComponent } from '../asta-os-orb.component';
import { AstaDropdownOption, AstaOsDropdownComponent } from '../ui/asta-os-dropdown.component';
import { AstaCodeEditorComponent } from './asta-code-editor.component';
import { PRACTICE_PROBLEMS } from './practice-problems';

interface PracticeMode {
  readonly value: string;
  readonly label: string;
  readonly agentMode: string;
  readonly directive: string;
}

const PRACTICE_MODES: readonly PracticeMode[] = [
  { value: 'hint', label: 'Hint only', agentMode: 'hint', directive: 'Give me a hint-first nudge. Point out where my thinking may be off and one small next step. Do NOT reveal the full solution.' },
  { value: 'debug', label: 'Debug with me', agentMode: 'debugging', directive: 'Debug with me step by step. Help me find the bug by reasoning about the output, without rewriting the whole solution.' },
  { value: 'full', label: 'Full explanation', agentMode: 'explain', directive: 'Explain the approach and the key idea clearly, then let me implement it.' },
  { value: 'interview', label: 'Interview', agentMode: 'interview', directive: 'Act as a technical interviewer: probe my reasoning with questions and hints rather than giving answers.' },
];

/** Hello-world starters for Free Play, per language. */
const FREE_TEMPLATES: Record<SupportedLanguage, string> = {
  javascript: 'console.log("Hello from Asta OS");\n',
  typescript: 'const msg: string = "Hello from Asta OS";\nconsole.log(msg);\n',
  python: 'print("Hello from Asta OS")\n',
  java: 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello from Asta OS");\n  }\n}\n',
  cpp: '#include <iostream>\nint main() {\n  std::cout << "Hello from Asta OS\\n";\n}\n',
  c: '#include <stdio.h>\nint main() {\n  printf("Hello from Asta OS\\n");\n  return 0;\n}\n',
  go: 'package main\nimport "fmt"\nfunc main() {\n  fmt.Println("Hello from Asta OS")\n}\n',
  rust: 'fn main() {\n  println!("Hello from Asta OS");\n}\n',
  bash: 'echo "Hello from Asta OS"\n',
  sql: "-- SQL is reviewed by Asta here (no live DB)\nSELECT 'Hello from Asta OS';\n",
};

/** localStorage key for the Free Play draft (instant recovery across reloads). */
const FREE_DRAFT_KEY = 'asta.practice.freeplay.draft.v1';

/** Default entry filename per language (for multi-file Free Play). */
const FREE_FILENAME: Record<SupportedLanguage, string> = {
  javascript: 'main.js',
  typescript: 'main.ts',
  python: 'main.py',
  java: 'Main.java',
  cpp: 'main.cpp',
  c: 'main.c',
  go: 'main.go',
  rust: 'main.rs',
  bash: 'main.sh',
  sql: 'query.sql',
};

/**
 * Practice Studio. Pick a problem, write code in a real editor, run it (JavaScript
 * in a browser sandbox; other languages on the server runner), check it against
 * tests, time yourself, and get Asta's help in your chosen learning mode. Passing
 * feeds the Proof Ledger; struggling feeds Mistake OS. Page under /app/os/practice.
 */
@Component({
  selector: 'asta-os-practice-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'asta-os-root' },
  imports: [RouterLink, MarkdownPipe, AstaOsOrbComponent, AstaOsDropdownComponent, AstaCodeEditorComponent],
  template: `
    <div class="studio">
      <header class="bar">
        <a routerLink="/app/os" class="back" aria-label="Back to Asta">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
          Asta
        </a>
        <h1>Practice Studio</h1>
        <div class="pickers">
          <div class="seg" role="group" aria-label="Studio mode">
            <button type="button" class="seg-b" [class.on]="studioMode() === 'problems'" (click)="studioMode.set('problems')">Problems</button>
            <button type="button" class="seg-b" [class.on]="studioMode() === 'free'" (click)="studioMode.set('free')">Free play</button>
            <button type="button" class="seg-b" [class.on]="studioMode() === 'terminal'" (click)="studioMode.set('terminal')">Terminal</button>
          </div>
          @if (studioMode() === 'problems') {
            <asta-os-dropdown [options]="problemOptions" [value]="problem().id" ariaLabel="Choose a problem" (valueChange)="pick($event)" />
          } @else if (studioMode() === 'free') {
            <asta-os-dropdown [options]="langOptions()" [value]="freeLang()" ariaLabel="Language" (valueChange)="setFreeLang($event)" />
          }
          <asta-os-dropdown [options]="modeOptions" [value]="practiceMode()" ariaLabel="How Asta helps" [compact]="true" (valueChange)="practiceMode.set($event)" />
        </div>
      </header>

      <div class="grid">
        <section class="left">
          @if (studioMode() === 'problems') {
            <div class="prompt">
              <div class="tags">
                <span class="tag" [attr.data-d]="problem().difficulty">{{ problem().difficulty }}</span>
                <span class="tag muted">{{ problem().skill }}</span>
                <span class="tag exec">{{ execLabel() }}</span>
              </div>
              <p class="statement">{{ problem().statement }}</p>
            </div>

            <asta-code-editor [value]="code()" [language]="problem().language" (valueChange)="code.set($event)" ariaLabel="Your solution" />

            <div class="actions">
              <button type="button" class="btn run" [disabled]="busy()" (click)="run()">▶ Run</button>
              <button type="button" class="btn submit" [disabled]="busy()" (click)="submit()">Check tests</button>
              <button type="button" class="btn ghost" [disabled]="thinking()" (click)="askAsta()">Ask Asta</button>
              @if (lastError()) {
                <button type="button" class="btn ghost" [disabled]="thinking()" (click)="explainError()">Explain error</button>
              }
              <span class="spacer"></span>
              <button type="button" class="timer" [class.on]="timerOn()" (click)="toggleTimer()" [title]="timerOn() ? 'Stop timer' : 'Start timer'">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M9 2h6" /></svg>
                {{ clock() }}
              </button>
              <button type="button" class="btn ghost sm" (click)="reset()">Reset</button>
            </div>
          } @else if (studioMode() === 'free') {
            <div class="prompt"><p class="statement">Free play — pick a language, write across files, and run it. <span class="exec-h">{{ freeExecLabel() }}</span></p></div>

            <div class="files">
              @for (f of freeFiles(); track $index) {
                <div class="file" [class.on]="$index === activeFile()">
                  <button type="button" class="file-pick" (click)="activeFile.set($index)">{{ f.name }}</button>
                  @if (freeFiles().length > 1) {
                    <button type="button" class="file-x" (click)="removeFile($index)" aria-label="Remove file">
                      <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                    </button>
                  }
                </div>
              }
              <button type="button" class="file-new" (click)="addFile()" aria-label="Add file">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              </button>
              <span class="spacer"></span>
              <button type="button" class="file-act" (click)="renameActiveFile()" title="Rename file">Rename</button>
              <button type="button" class="file-act" (click)="downloadActiveFile()" title="Download file">Download</button>
            </div>

            <asta-code-editor [value]="activeContent()" [language]="freeLang()" (valueChange)="setActiveContent($event)" ariaLabel="Free code" />

            <label class="stdin-l">
              <span>stdin (optional)</span>
              <textarea class="stdin" rows="2" spellcheck="false" [value]="freeStdin()" (input)="freeStdin.set($any($event.target).value)" placeholder="Input passed to your program"></textarea>
            </label>

            <div class="actions">
              <button type="button" class="btn run" [disabled]="busy()" (click)="runFree()">▶ Run</button>
              <button type="button" class="btn ghost" [disabled]="thinking()" (click)="askFree()">Ask Asta</button>
              @if (lastError()) {
                <button type="button" class="btn ghost" [disabled]="thinking()" (click)="explainError()">Explain error</button>
              }
              <span class="spacer"></span>
              <button type="button" class="btn ghost sm" (click)="resetFree()">Reset</button>
            </div>
          } @else {
            <div class="prompt"><p class="statement">Mini terminal — run bash commands on the server runner. Each command runs in a fresh sandbox.</p></div>

            <div class="term">
              @for (h of termHistory(); track $index) {
                <div class="t-cmd"><span class="t-ps">$</span> {{ h.cmd }}</div>
                @if (h.out) { <pre class="t-out">{{ h.out }}</pre> }
                @if (h.err) { <pre class="t-out err">{{ h.err }}</pre> }
              }
              <div class="t-line">
                <span class="t-ps">$</span>
                <input
                  class="t-input"
                  spellcheck="false"
                  autocomplete="off"
                  [value]="termInput()"
                  [disabled]="termBusy()"
                  (input)="termInput.set($any($event.target).value)"
                  (keydown.enter)="runTerm()"
                  placeholder="echo hello && uname -a"
                  aria-label="Terminal command"
                />
              </div>
            </div>

            <div class="actions">
              <button type="button" class="btn run" [disabled]="termBusy()" (click)="runTerm()">Run</button>
              <button type="button" class="btn ghost sm" (click)="termHistory.set([])">Clear</button>
            </div>
          }
        </section>

        <section class="right">
          <div class="panel">
            <p class="head">Output</p>
            @if (validation(); as v) {
              <div class="tests">
                <p class="score" [class.win]="v.passed === v.total && v.total > 0">
                  {{ v.passed }} / {{ v.total }} tests passing
                  @if (v.passed === v.total && v.total > 0) { <span class="trophy">🏆 Solved</span> }
                </p>
                <ul>
                  @for (r of v.results; track r.name) {
                    <li [class.pass]="r.passed">
                      <span class="mk">{{ r.passed ? '✓' : '✕' }}</span><span class="nm">{{ r.name }}</span>
                      @if (r.detail) { <span class="dt">{{ r.detail }}</span> }
                    </li>
                  }
                </ul>
              </div>
            }
            @if (runResult()?.stdout; as out) { <pre class="console">{{ out }}</pre> }
            @if (lastError(); as err) { <pre class="console err">{{ err }}</pre> }
            @if (runResult(); as r) { <p class="timing">ran in {{ r.durationMs }}ms{{ r.simulated ? ' · simulated' : '' }}</p> }
            @if (note(); as n) { <p class="sim">{{ n }}</p> }
            @if (!validation() && !runResult() && !lastError()) {
              <p class="empty">Run your code or check it against the tests.</p>
            }
          </div>

          <div class="panel asta">
            <div class="head-row"><p class="head">Asta · {{ modeLabel() }}</p><asta-os-orb size="sm" [state]="thinking() ? 'thinking' : 'idle'" /></div>
            @if (thinking()) {
              <p class="empty">Asta is looking at your code…</p>
            } @else if (astaAnswer()) {
              <div class="prose" [innerHTML]="astaAnswer() | markdown"></div>
            } @else {
              <p class="empty">Stuck? Ask Asta — you’ll get help in “{{ modeLabel() }}” mode.</p>
            }
          </div>

          @if (studioMode() === 'free') {
            <div class="panel">
              <p class="head">Saved snippets</p>
              <div class="save-row">
                <input
                  class="snip-name"
                  spellcheck="false"
                  [value]="snippetTitle()"
                  (input)="snippetTitle.set($any($event.target).value)"
                  (keydown.enter)="saveSnippet()"
                  placeholder="Name this snippet"
                  aria-label="Snippet name"
                />
                <button type="button" class="btn submit sm" [disabled]="savingSnippet()" (click)="saveSnippet()">Save</button>
              </div>
              @if (snippets().length) {
                <ul class="snips">
                  @for (s of snippets(); track s.id) {
                    <li>
                      <button type="button" class="snip-load" (click)="loadSnippet(s)" [title]="'Load ' + s.title">
                        <span class="snip-t">{{ s.title }}</span>
                        <span class="snip-m">{{ s.language }} · {{ s.files.length }} file{{ s.files.length === 1 ? '' : 's' }}</span>
                      </button>
                      <button type="button" class="snip-x" (click)="deleteSnippet(s.id, $event)" aria-label="Delete snippet">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2m-1 0v14H9V6" /></svg>
                      </button>
                    </li>
                  }
                </ul>
              } @else {
                <p class="empty">No saved snippets yet — write something in Free Play and hit Save.</p>
              }
            </div>
          }

          <div class="panel">
            <p class="head">Recent runs</p>
            @if (runHistory().length) {
              <ul class="runs">
                @for (r of runHistory(); track r.id) {
                  <li [class.ok]="r.ok">
                    <span class="r-dot" [class.bad]="!r.ok"></span>
                    <span class="r-lang">{{ r.language }}</span>
                    <span class="r-kind">{{ r.kind }}</span>
                    @if (r.title) { <span class="r-title">{{ r.title }}</span> }
                    <span class="r-res">{{ runLabel(r) }}</span>
                    @if (r.simulated) { <span class="r-sim">sim</span> }
                  </li>
                }
              </ul>
            } @else {
              <p class="empty">Your run history will show up here.</p>
            }
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [
    `
      :host { display: block; min-height: 100%; background: var(--asta-bg); color: var(--asta-text); }
      .studio { max-width: 1320px; margin: 0 auto; padding: 16px; }
      .bar { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
      .bar h1 { font-family: var(--display); font-size: 20px; font-weight: 600; flex: 1; }
      .back { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--asta-muted); padding: 6px 10px; border-radius: 999px; border: 1px solid var(--asta-border); }
      .back:hover { color: var(--asta-text); }
      .pickers { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
      .seg { display: inline-flex; gap: 2px; padding: 3px; border-radius: 999px; background: var(--asta-panel); border: 1px solid var(--asta-border); }
      .seg-b { font-size: 12px; font-weight: 600; padding: 5px 12px; border-radius: 999px; color: var(--asta-muted); }
      .seg-b.on { color: #06100a; background: linear-gradient(135deg, var(--asta-green), var(--asta-green-deep)); }
      .exec-h { color: var(--asta-cyan); }
      .files { display: flex; align-items: center; gap: 5px; margin-bottom: 8px; flex-wrap: wrap; }
      .file { display: inline-flex; align-items: center; gap: 2px; padding: 3px 4px 3px 11px; border-radius: 9px 9px 0 0; border: 1px solid var(--asta-border); border-bottom: none; background: var(--asta-panel); }
      .file.on { background: var(--asta-bg-soft); border-color: color-mix(in srgb, var(--asta-green) 40%, transparent); }
      .file-pick { font-family: var(--mono); font-size: 12px; color: var(--asta-muted); }
      .file.on .file-pick { color: var(--asta-text); }
      .file-x { display: grid; place-items: center; width: 18px; height: 18px; border-radius: 999px; color: var(--asta-subtle); }
      .file-x:hover { color: var(--asta-coral); }
      .file-new { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 8px; color: var(--asta-muted); border: 1px solid var(--asta-border); }
      .file-new:hover { color: var(--asta-green); border-color: color-mix(in srgb, var(--asta-green) 40%, transparent); }
      .files .spacer { flex: 1; }
      .file-act { font-size: 11.5px; font-weight: 600; color: var(--asta-muted); padding: 4px 9px; border-radius: 8px; border: 1px solid var(--asta-border); }
      .file-act:hover { color: var(--asta-text); border-color: color-mix(in srgb, var(--asta-green) 35%, transparent); }
      .stdin-l { display: flex; flex-direction: column; gap: 5px; margin-top: 10px; font-size: 11.5px; color: var(--asta-muted); font-family: var(--mono); text-transform: uppercase; letter-spacing: .04em; }
      .stdin { resize: vertical; font-family: var(--mono); font-size: 13px; color: var(--asta-text); background: var(--asta-bg-soft); border: 1px solid var(--asta-border); border-radius: 10px; padding: 8px 10px; outline: none; }
      .stdin:focus { border-color: color-mix(in srgb, var(--asta-green) 50%, transparent); }
      .timing { margin-top: 8px; font-family: var(--mono); font-size: 11px; color: var(--asta-subtle); }
      .term { font-family: var(--mono); font-size: 13px; line-height: 1.5; background: var(--asta-bg); border: 1px solid var(--asta-border); border-radius: 14px; padding: 12px 14px; min-height: 280px; max-height: 50vh; overflow-y: auto; }
      .t-cmd { color: var(--asta-text); margin-top: 8px; }
      .t-cmd:first-child { margin-top: 0; }
      .t-ps { color: var(--asta-green); font-weight: 700; }
      .t-out { color: var(--asta-muted); white-space: pre-wrap; word-break: break-word; margin: 2px 0 0; }
      .t-out.err { color: var(--asta-coral); }
      .t-line { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
      .t-input { flex: 1; background: transparent; border: 0; outline: none; color: var(--asta-text); font-family: var(--mono); font-size: 13px; }

      .grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr); gap: 16px; }
      @media (max-width: 980px) { .grid { grid-template-columns: 1fr; } }

      .prompt { padding: 16px; border-radius: 16px; background: var(--asta-panel); border: 1px solid var(--asta-border); margin-bottom: 12px; }
      .tags { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 10px; }
      .tag { font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 999px; border: 1px solid var(--asta-border); text-transform: capitalize; }
      .tag.muted { color: var(--asta-muted); }
      .tag.exec { color: var(--asta-cyan); border-color: color-mix(in srgb, var(--asta-cyan) 35%, transparent); text-transform: none; }
      .tag[data-d='easy'] { color: var(--asta-green); border-color: color-mix(in srgb, var(--asta-green) 40%, transparent); }
      .tag[data-d='medium'] { color: var(--asta-gold); border-color: color-mix(in srgb, var(--asta-gold) 40%, transparent); }
      .tag[data-d='hard'] { color: var(--asta-coral); border-color: color-mix(in srgb, var(--asta-coral) 40%, transparent); }
      .statement { font-size: 14.5px; line-height: 1.6; }

      .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 12px; }
      .actions .spacer { flex: 1; }
      .btn { font-size: 13px; font-weight: 600; padding: 8px 16px; border-radius: 999px; border: 1px solid var(--asta-border); color: var(--asta-text); transition: transform .14s ease, opacity .14s ease; }
      .btn.sm { padding: 7px 12px; }
      .btn:disabled { opacity: .5; cursor: default; }
      .btn:not(:disabled):hover { transform: translateY(-1px); }
      .btn.run { color: #06100a; background: linear-gradient(135deg, var(--asta-green), var(--asta-green-deep)); border-color: transparent; }
      .btn.submit { color: var(--asta-cyan); border-color: color-mix(in srgb, var(--asta-cyan) 45%, transparent); }
      .btn.ghost { color: var(--asta-muted); background: transparent; }
      .timer { display: inline-flex; align-items: center; gap: 6px; font-family: var(--mono); font-size: 12px; padding: 6px 11px; border-radius: 999px; border: 1px solid var(--asta-border); color: var(--asta-muted); }
      .timer.on { color: var(--asta-green); border-color: color-mix(in srgb, var(--asta-green) 40%, transparent); }

      .panel { padding: 16px; border-radius: 16px; background: var(--asta-panel); border: 1px solid var(--asta-border); margin-bottom: 12px; }
      .head { font-family: var(--mono); font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--asta-muted); margin-bottom: 10px; }
      .head-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
      .head-row .head { margin-bottom: 0; }
      .empty { font-size: 13px; color: var(--asta-muted); line-height: 1.55; }
      .score { font-size: 14px; font-weight: 600; margin-bottom: 10px; color: var(--asta-coral); display: flex; align-items: center; gap: 8px; }
      .score.win { color: var(--asta-green); }
      .trophy { font-size: 12px; }
      .tests ul { display: flex; flex-direction: column; gap: 6px; }
      .tests li { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--asta-muted); flex-wrap: wrap; }
      .tests li.pass { color: var(--asta-text); }
      .tests .mk { color: var(--asta-coral); font-weight: 700; }
      .tests li.pass .mk { color: var(--asta-green); }
      .tests .dt { font-family: var(--mono); font-size: 11.5px; color: var(--asta-subtle); width: 100%; padding-left: 20px; }
      .console { font-family: var(--mono); font-size: 12.5px; line-height: 1.5; background: var(--asta-bg); border: 1px solid var(--asta-border); border-radius: 10px; padding: 10px 12px; margin-top: 10px; white-space: pre-wrap; word-break: break-word; max-height: 240px; overflow: auto; }
      .console.err { color: var(--asta-coral); }
      .sim { margin-top: 10px; font-size: 12px; color: var(--asta-gold); }
      .prose { font-size: 14px; line-height: 1.6; }
      .prose :is(code) { font-family: var(--mono); background: var(--asta-panel-strong); padding: 1px 5px; border-radius: 5px; font-size: 12.5px; }
      .prose :is(pre) { background: var(--asta-bg); padding: 10px 12px; border-radius: 10px; overflow: auto; border: 1px solid var(--asta-border); }

      .save-row { display: flex; gap: 8px; margin-bottom: 12px; }
      .snip-name { flex: 1; min-width: 0; font-size: 13px; color: var(--asta-text); background: var(--asta-bg-soft); border: 1px solid var(--asta-border); border-radius: 9px; padding: 7px 10px; outline: none; }
      .snip-name:focus { border-color: color-mix(in srgb, var(--asta-green) 50%, transparent); }
      .snips { display: flex; flex-direction: column; gap: 6px; }
      .snips li { display: flex; align-items: center; gap: 6px; }
      .snip-load { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; text-align: left; padding: 7px 10px; border-radius: 9px; border: 1px solid var(--asta-border); background: var(--asta-bg-soft); }
      .snip-load:hover { border-color: color-mix(in srgb, var(--asta-green) 40%, transparent); }
      .snip-t { font-size: 13px; font-weight: 600; color: var(--asta-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .snip-m { font-family: var(--mono); font-size: 10.5px; color: var(--asta-subtle); text-transform: uppercase; letter-spacing: .04em; }
      .snip-x { display: grid; place-items: center; width: 28px; height: 28px; flex: none; border-radius: 8px; color: var(--asta-subtle); border: 1px solid var(--asta-border); }
      .snip-x:hover { color: var(--asta-coral); border-color: color-mix(in srgb, var(--asta-coral) 40%, transparent); }

      .runs { display: flex; flex-direction: column; gap: 5px; max-height: 220px; overflow-y: auto; }
      .runs li { display: flex; align-items: center; gap: 7px; font-size: 12px; color: var(--asta-muted); padding: 4px 2px; }
      .r-dot { width: 7px; height: 7px; flex: none; border-radius: 50%; background: var(--asta-green); }
      .r-dot.bad { background: var(--asta-coral); }
      .r-lang { font-family: var(--mono); font-size: 11px; color: var(--asta-text); }
      .r-kind { font-size: 10.5px; text-transform: uppercase; letter-spacing: .04em; color: var(--asta-subtle); }
      .r-title { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--asta-muted); }
      .r-res { margin-left: auto; font-size: 11.5px; color: var(--asta-muted); }
      .r-sim { font-size: 10px; color: var(--asta-gold); border: 1px solid color-mix(in srgb, var(--asta-gold) 35%, transparent); border-radius: 6px; padding: 0 5px; }
    `,
  ],
})
export class AstaOsPracticePanelComponent {
  private readonly practice = inject(PracticeService);
  private readonly agent = inject(AgentService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly codeHandoff = inject(CodeHandoffService);

  protected readonly problems = PRACTICE_PROBLEMS;
  protected readonly problem = signal<PracticeProblem>(PRACTICE_PROBLEMS[0]);
  protected readonly code = signal<string>(PRACTICE_PROBLEMS[0].starterCode);
  protected readonly practiceMode = signal<string>('hint');

  // ── Free play (multi-file) ──
  protected readonly studioMode = signal<'problems' | 'free' | 'terminal'>('problems');
  protected readonly freeLang = signal<SupportedLanguage>('python');
  protected readonly freeFiles = signal<{ name: string; content: string }[]>([{ name: FREE_FILENAME.python, content: FREE_TEMPLATES.python }]);
  protected readonly activeFile = signal(0);
  protected readonly freeStdin = signal<string>('');
  protected readonly activeContent = computed(() => this.freeFiles()[this.activeFile()]?.content ?? '');

  // ── Mini terminal ──
  protected readonly termHistory = signal<{ cmd: string; out: string; err?: string }[]>([]);
  protected readonly termInput = signal<string>('');
  protected readonly termBusy = signal(false);

  protected readonly busy = signal(false);
  protected readonly thinking = signal(false);
  protected readonly runResult = signal<CodeRunResult | null>(null);
  protected readonly validation = signal<CodeValidationResult | null>(null);
  protected readonly astaAnswer = signal<string | null>(null);
  private readonly languages = signal<LanguageInfo[]>([]);

  protected readonly elapsed = signal(0);
  protected readonly timerOn = signal(false);
  private ticker?: ReturnType<typeof setInterval>;

  // ── Snippet library + run history ──
  protected readonly snippets = signal<SavedSnippet[]>([]);
  protected readonly runHistory = signal<PracticeRunRecord[]>([]);
  protected readonly snippetTitle = signal<string>('');
  protected readonly savingSnippet = signal(false);
  private localSeq = 0;

  protected readonly problemOptions: AstaDropdownOption[] = this.problems.map((p) => ({
    value: p.id,
    label: p.title,
    hint: `${p.difficulty} · ${p.language}`,
  }));
  protected readonly modeOptions: AstaDropdownOption[] = PRACTICE_MODES.map((m) => ({ value: m.value, label: m.label }));

  protected readonly lastError = computed(() => this.runResult()?.stderr ?? this.validation()?.stderr ?? null);
  protected readonly note = computed(() => this.runResult()?.note ?? this.validation()?.note ?? null);
  protected readonly modeLabel = computed(() => PRACTICE_MODES.find((m) => m.value === this.practiceMode())?.label ?? 'Hint only');
  protected readonly clock = computed(() => {
    const s = this.elapsed();
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });
  protected readonly execLabel = computed(() => this.execFor(this.problem().language));
  protected readonly freeExecLabel = computed(() => this.execFor(this.freeLang()));
  protected readonly langOptions = computed<AstaDropdownOption[]>(() => {
    const langs = this.languages();
    const list = langs.length ? langs : (Object.keys(FREE_TEMPLATES) as SupportedLanguage[]).map((id) => ({ id, label: id, execution: 'runner' as const }));
    return list.map((l) => ({ value: l.id, label: l.label }));
  });

  constructor() {
    this.practice
      .languages()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (l) => this.languages.set(l), error: () => undefined });
    this.destroyRef.onDestroy(() => this.stopTicker());

    // A handoff from chat wins; otherwise recover the last unsaved Free Play draft.
    if (!this.loadHandoff()) this.restoreDraft();
    this.refreshLibrary();

    // Autosave the Free Play draft so closing the tab no longer loses work.
    effect(() => {
      const draft = { lang: this.freeLang(), files: this.freeFiles(), stdin: this.freeStdin() };
      try {
        localStorage.setItem(FREE_DRAFT_KEY, JSON.stringify(draft));
      } catch {
        /* storage full / unavailable — non-fatal */
      }
    });
  }

  /** If a chat reply sent a snippet via "Run in Lab", drop it into Free Play. */
  private loadHandoff(): boolean {
    const handoff = this.codeHandoff.take();
    if (!handoff) return false;
    const ALIASES: Record<string, SupportedLanguage> = {
      js: 'javascript', javascript: 'javascript', ts: 'typescript', typescript: 'typescript',
      py: 'python', python: 'python', java: 'java', c: 'c', cpp: 'cpp', 'c++': 'cpp',
      go: 'go', rust: 'rust', rs: 'rust', bash: 'bash', sh: 'bash', sql: 'sql',
    };
    const lang = ALIASES[handoff.language.toLowerCase()] ?? 'python';
    this.studioMode.set('free');
    this.freeLang.set(lang);
    this.freeFiles.set([{ name: FREE_FILENAME[lang], content: handoff.code }]);
    this.activeFile.set(0);
    return true;
  }

  /** Restore the last Free Play draft from localStorage (no server round-trip). */
  private restoreDraft(): void {
    try {
      const raw = localStorage.getItem(FREE_DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as { lang?: SupportedLanguage; files?: { name: string; content: string }[]; stdin?: string };
      if (d.lang && d.files?.length) {
        this.freeLang.set(d.lang);
        this.freeFiles.set(d.files.map((f) => ({ name: f.name, content: f.content })));
        this.freeStdin.set(d.stdin ?? '');
        this.activeFile.set(0);
      }
    } catch {
      /* corrupt draft — ignore */
    }
  }

  /** Pull saved snippets + recent run history from the server. */
  private refreshLibrary(): void {
    this.practice
      .listSnippets()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (s) => this.snippets.set(s), error: () => undefined });
    this.practice
      .history()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (h) => this.runHistory.set(h), error: () => undefined });
  }

  // ── Snippet library actions ──

  protected saveSnippet(): void {
    if (this.savingSnippet()) return;
    const title = this.snippetTitle().trim() || `${this.freeLang()} snippet`;
    this.savingSnippet.set(true);
    this.practice
      .saveSnippet({ title, language: this.freeLang(), files: this.freeFiles(), stdin: this.freeStdin() || undefined })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (s) => {
          this.snippets.update((list) => [s, ...list.filter((x) => x.id !== s.id)]);
          this.snippetTitle.set('');
          this.savingSnippet.set(false);
          this.toast.success('Snippet saved');
        },
        error: () => {
          this.savingSnippet.set(false);
          this.toast.error('Could not save snippet');
        },
      });
  }

  protected loadSnippet(s: SavedSnippet): void {
    this.studioMode.set('free');
    this.freeLang.set(s.language);
    this.freeFiles.set(
      s.files.length ? s.files.map((f) => ({ name: f.name, content: f.content })) : [{ name: FREE_FILENAME[s.language], content: FREE_TEMPLATES[s.language] }],
    );
    this.freeStdin.set(s.stdin ?? '');
    this.activeFile.set(0);
    this.runResult.set(null);
    this.validation.set(null);
  }

  protected deleteSnippet(id: string, ev: Event): void {
    ev.stopPropagation();
    this.practice
      .deleteSnippet(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.snippets.update((list) => list.filter((s) => s.id !== id)),
        error: () => undefined,
      });
  }

  protected renameActiveFile(): void {
    const i = this.activeFile();
    const cur = this.freeFiles()[i];
    if (!cur) return;
    const name = (typeof prompt === 'function' ? prompt('Rename file', cur.name) : cur.name)?.trim();
    if (!name) return;
    this.freeFiles.update((fs) => fs.map((f, idx) => (idx === i ? { ...f, name } : f)));
  }

  protected downloadActiveFile(): void {
    const f = this.freeFiles()[this.activeFile()];
    if (!f) return;
    const url = URL.createObjectURL(new Blob([f.content], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = f.name || 'snippet.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Optimistically prepend a run to the local history (server persists in the background). */
  private pushHistory(p: {
    language: SupportedLanguage;
    kind: RunKind;
    ok: boolean;
    simulated: boolean;
    durationMs: number;
    title?: string;
    passed?: number;
    total?: number;
    codePreview: string;
  }): void {
    const rec: PracticeRunRecord = {
      id: `local-${this.localSeq++}`,
      at: new Date().toISOString(),
      ...p,
      codePreview: p.codePreview.slice(0, 280),
    };
    this.runHistory.update((h) => [rec, ...h].slice(0, 25));
  }

  protected runLabel(r: PracticeRunRecord): string {
    if (r.kind === 'submit' && r.total) return `${r.passed ?? 0}/${r.total} tests`;
    return r.ok ? 'ran ok' : 'error';
  }

  protected pick(id: string): void {
    const next = this.problems.find((p) => p.id === id);
    if (next) {
      this.problem.set(next);
      this.reset();
    }
  }

  protected reset(): void {
    this.code.set(this.problem().starterCode);
    this.runResult.set(null);
    this.validation.set(null);
    this.astaAnswer.set(null);
  }

  private execFor(lang: SupportedLanguage): string {
    const info = this.languages().find((l) => l.id === lang);
    if (!info) return lang;
    return info.execution === 'browser' ? 'Runs in your browser' : info.execution === 'runner' ? 'Runs on the server runner' : 'Reviewed by Asta (no live runner)';
  }

  protected setFreeLang(lang: string): void {
    const l = lang as SupportedLanguage;
    this.freeLang.set(l);
    this.freeFiles.set([{ name: FREE_FILENAME[l], content: FREE_TEMPLATES[l] }]);
    this.activeFile.set(0);
    this.runResult.set(null);
  }

  protected setActiveContent(content: string): void {
    const i = this.activeFile();
    this.freeFiles.update((fs) => fs.map((f, idx) => (idx === i ? { ...f, content } : f)));
  }

  protected addFile(): void {
    const ext = FREE_FILENAME[this.freeLang()].split('.').pop() ?? 'txt';
    this.freeFiles.update((fs) => [...fs, { name: `file${fs.length}.${ext}`, content: '' }]);
    this.activeFile.set(this.freeFiles().length - 1);
  }

  protected removeFile(index: number): void {
    if (this.freeFiles().length <= 1) return;
    this.freeFiles.update((fs) => fs.filter((_, i) => i !== index));
    this.activeFile.set(Math.max(0, Math.min(this.activeFile(), this.freeFiles().length - 1)));
  }

  protected resetFree(): void {
    this.setFreeLang(this.freeLang());
    this.freeStdin.set('');
    this.astaAnswer.set(null);
  }

  protected async runFree(): Promise<void> {
    this.busy.set(true);
    this.validation.set(null);
    const files = this.freeFiles();
    try {
      const r = await this.practice.run({
        language: this.freeLang(),
        code: files[0]?.content ?? '',
        stdin: this.freeStdin() || undefined,
        files: files.length > 1 ? files : undefined,
      });
      this.runResult.set(r);
      this.pushHistory({ language: this.freeLang(), kind: 'free', ok: r.ok, simulated: r.simulated, durationMs: r.durationMs, codePreview: files[0]?.content ?? '' });
    } finally {
      this.busy.set(false);
    }
  }

  protected async runTerm(): Promise<void> {
    const cmd = this.termInput().trim();
    if (!cmd || this.termBusy()) return;
    this.termBusy.set(true);
    this.termInput.set('');
    try {
      const r = await this.practice.run({ language: 'bash', code: cmd });
      const out = r.simulated ? (r.note ?? '') : r.stdout;
      this.termHistory.update((h) => [...h, { cmd, out, err: r.stderr }]);
    } catch {
      this.termHistory.update((h) => [...h, { cmd, out: '', err: 'Command failed to run.' }]);
    } finally {
      this.termBusy.set(false);
    }
  }

  protected askFree(): void {
    const mode = PRACTICE_MODES.find((m) => m.value === this.practiceMode()) ?? PRACTICE_MODES[0];
    const out = this.runResult();
    const ctx = `\n\nMy ${this.freeLang()} code:\n\`\`\`${this.freeLang()}\n${this.activeContent()}\n\`\`\`${out?.stdout ? `\n\nOutput:\n${out.stdout}` : ''}${out?.stderr ? `\n\nError:\n${out.stderr}` : ''}`;
    this.send(`${mode.directive}${ctx}`, mode.agentMode);
  }

  protected async run(): Promise<void> {
    this.busy.set(true);
    this.validation.set(null);
    this.ensureTimer();
    try {
      const r = await this.practice.run({ language: this.problem().language, code: this.code() });
      this.runResult.set(r);
      this.pushHistory({ language: this.problem().language, kind: 'run', ok: r.ok, simulated: r.simulated, durationMs: r.durationMs, title: this.problem().title, codePreview: this.code() });
    } finally {
      this.busy.set(false);
    }
  }

  protected async submit(): Promise<void> {
    this.busy.set(true);
    this.runResult.set(null);
    this.ensureTimer();
    try {
      const result = await this.practice.submit(this.problem(), this.code());
      this.validation.set(result);
      this.pushHistory({ language: this.problem().language, kind: 'submit', ok: result.ok, simulated: result.simulated, durationMs: 0, passed: result.passed, total: result.total, title: this.problem().title, codePreview: this.code() });
      if (!result.simulated) {
        this.practice.record(this.problem(), result.ok).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => undefined });
      }
      if (result.ok) {
        this.toast.success('Solved — added to your proof');
        this.timerOn.set(false);
        this.stopTicker();
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected askAsta(): void {
    const mode = PRACTICE_MODES.find((m) => m.value === this.practiceMode()) ?? PRACTICE_MODES[0];
    this.send(`${mode.directive}${this.contextBlock()}`, mode.agentMode);
  }

  protected explainError(): void {
    const err = this.lastError();
    if (!err) return;
    this.send(`My code produced this error:\n\n${err}\n\nExplain what it means and how to think about fixing it — don’t write the whole solution.${this.contextBlock()}`, 'debugging');
  }

  private contextBlock(): string {
    if (this.studioMode() === 'free') {
      return `\n\nMy ${this.freeLang()} code:\n\`\`\`${this.freeLang()}\n${this.activeContent()}\n\`\`\``;
    }
    const p = this.problem();
    return `\n\nProblem: ${p.title}\n${p.statement}\n\nMy current ${p.language} code:\n\`\`\`${p.language}\n${this.code()}\n\`\`\``;
  }

  private send(message: string, agentMode: string): void {
    if (this.thinking()) return;
    this.thinking.set(true);
    this.astaAnswer.set(null);
    this.agent
      .send(message, { mode: agentMode, agentType: 'tutor' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.astaAnswer.set(r.response.answer);
          this.thinking.set(false);
        },
        error: () => {
          this.astaAnswer.set('Asta couldn’t respond just now. Try again in a moment.');
          this.thinking.set(false);
        },
      });
  }

  protected toggleTimer(): void {
    if (this.timerOn()) {
      this.timerOn.set(false);
      this.stopTicker();
    } else {
      this.timerOn.set(true);
      this.startTicker();
    }
  }

  private ensureTimer(): void {
    if (!this.timerOn()) {
      this.timerOn.set(true);
      this.startTicker();
    }
  }

  private startTicker(): void {
    this.stopTicker();
    this.ticker = setInterval(() => this.elapsed.update((s) => s + 1), 1000);
  }

  private stopTicker(): void {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = undefined;
    }
  }
}
