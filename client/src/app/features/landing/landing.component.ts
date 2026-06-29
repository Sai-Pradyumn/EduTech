import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LogoComponent } from '../../shared/ui/logo.component';
import { DotGridComponent } from '../../shared/components/dot-grid.component';
import { CountUpDirective } from '../../shared/directives/count-up.directive';
import { MagneticDirective } from '../../shared/directives/magnetic.directive';
import { landingStyles } from './landing.styles';
import { ThemeToggleComponent } from '../../shared/ui/theme-toggle.component';
import { TiltDirective } from '../../shared/directives/tilt.directive';

/**
 * Landing page — a faithful Angular port of the design contract
 * (EduTechDesign/index.html + landing.css + landing.js) with every signature
 * interaction: scroll-blur nav, hero isometric tilt + animated path,
 * moving dot-grid background, marquee, scroll-drawn journey path with milestone
 * pops, agent glyph grid, live streaming mini-chat demo, mini-roadmap, count-up
 * stats, CTA glow, footer. Honors prefers-reduced-motion.
 */
@Component({
    selector: 'asta-landing',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterLink, LogoComponent, DotGridComponent, CountUpDirective, MagneticDirective, ThemeToggleComponent, TiltDirective],
    template: `
    <!-- ===================== NAV ===================== -->
    <header class="nav" [class.scrolled]="scrolled()">
      <div class="wrap nav-inner">
        <a class="logo" routerLink="/" aria-label="Asta home"><asta-logo [size]="28" /></a>
        <nav class="nav-links" aria-label="Primary">
          <a href="#journey" (click)="scrollTo('journey', $event)">The Path</a>
          <a href="#agents" (click)="scrollTo('agents', $event)">Agents</a>
          <a href="#product" (click)="scrollTo('product', $event)">Platform</a>
          <a href="#proof" (click)="scrollTo('proof', $event)">Outcomes</a>
        </nav>
        <div class="nav-cta">
          <asta-theme-toggle />
          <a routerLink="/login" class="nav-login">Log in</a>
          <a class="btn btn-accent nav-start" astaMagnetic role="button" tabindex="0" (click)="goStart()" (keyup.enter)="goStart()">
            Start learning <span class="arrow">→</span>
          </a>
        </div>
      </div>
    </header>

    <!-- ===================== HERO ===================== -->
    <section class="hero">
      <asta-dot-grid [opacity]="0.55" [parallax]="true" [gap]="22" [speed]="60" />
      <svg class="hero-path" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="pathFade" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="var(--green)" stop-opacity="0" />
            <stop offset="0.5" stop-color="var(--green)" stop-opacity="1" />
            <stop offset="1" stop-color="var(--peri)" stop-opacity="1" />
          </linearGradient>
        </defs>
        <path
          id="heroLine"
          d="M-40 720 C 240 720, 300 480, 540 470 S 880 560, 980 380 S 1200 140, 1500 180"
          fill="none" stroke="url(#pathFade)" stroke-width="2.5" stroke-dasharray="10 14"
          stroke-linecap="round" opacity=".55"
        />
      </svg>

      <div class="wrap hero-inner">
        <div class="hero-copy">
          <span class="pill hero-pill reveal"><span class="dot"></span> AI-native learning OS</span>
          <h1 class="hero-h1 reveal" data-d="1">
            Learning is a long &amp; winding road.
            <em>We turn it into a path.</em>
          </h1>
          <p class="hero-sub reveal" data-d="2">
            Asta is your personal AI skill mentor — one platform of intelligent agents that build your
            roadmap, teach you, answer doubts from trusted sources, quiz you, and help you ship real projects.
          </p>
          <div class="hero-actions reveal" data-d="3">
            <a class="btn btn-accent" astaMagnetic role="button" tabindex="0" (click)="goStart()" (keyup.enter)="goStart()">Build my roadmap <span class="arrow">→</span></a>
            <a class="btn btn-ghost" href="#product" (click)="scrollTo('product', $event)">See how it works</a>
          </div>
          <div class="hero-meta reveal" data-d="4">
            <span><b>8</b> specialist agents</span>
            <span class="sep"></span>
            <span><b>1</b> learning path, made for you</span>
          </div>
        </div>

        <div class="hero-visual" #heroVisual aria-hidden="true">
          <div class="iso" #iso>
            <div class="iso-plate p1"></div>
            <div class="iso-plate p2"></div>
            <div class="iso-plate p3"></div>
            <div class="iso-node n1"><span></span></div>
            <div class="iso-node n2"><span></span></div>
            <div class="iso-node n3"><span></span></div>
            <div class="iso-chip c1 mono">roadmap.agent</div>
            <div class="iso-chip c2 mono">tutor.agent</div>
            <div class="iso-chip c3 mono">rag.search()</div>
          </div>
        </div>
      </div>

      <a href="#journey" class="scroll-cue" (click)="scrollTo('journey', $event)" aria-label="Scroll">
        <span class="mono">scroll</span>
        <span class="scroll-track"><span class="scroll-dot"></span></span>
      </a>
    </section>

    <!-- ===================== MARQUEE ===================== -->
    <section class="marquee-wrap" aria-label="Outcomes learners pursue">
      <div class="marquee">
        @for (dup of [0, 1]; track dup) {
          <div class="marquee-row" [attr.aria-hidden]="dup === 1 ? 'true' : null">
            @for (o of outcomes; track o) {
              <span>{{ o }}</span><span class="m-dot">◆</span>
            }
          </div>
        }
      </div>
    </section>

    <!-- ===================== JOURNEY / THE PATH ===================== -->
    <section class="section journey dark" id="journey">
      <div class="wrap">
        <div class="journey-head reveal">
          <span class="kicker">The journey</span>
          <h2>From “where do I even start?”<br />to landing the role.</h2>
          <p class="lead">
            Most learners drown in scattered courses. Asta gives you one continuous path — and an agent
            walking every step with you.
          </p>
        </div>
      </div>

      <div class="path-stage" #pathStage>
        <svg class="path-svg" viewBox="0 0 1200 560" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <path
            d="M80 470 C 240 470, 250 360, 360 350 S 540 400, 600 300 S 720 150, 840 180 S 1040 250, 1120 110"
            fill="none" stroke="var(--ink-3)" stroke-width="2.5"
          />
          <path
            #journeyProgress
            d="M80 470 C 240 470, 250 360, 360 350 S 540 400, 600 300 S 720 150, 840 180 S 1040 250, 1120 110"
            fill="none" stroke="var(--green)" stroke-width="3" stroke-linecap="round"
          />
        </svg>
        <div class="milestones" #milestones>
          <div class="ms" style="left:6.6%; top:84%"><i>01</i><h4>Assess</h4><p>A 4-min check finds your real level &amp; gaps.</p></div>
          <div class="ms" style="left:30%; top:62%"><i>02</i><h4>Roadmap</h4><p>An agent builds a week-by-week plan to your goal.</p></div>
          <div class="ms" style="left:50%; top:53%"><i>03</i><h4>Learn</h4><p>Your AI tutor explains, hints, and goes Socratic.</p></div>
          <div class="ms" style="left:70%; top:31%"><i>04</i><h4>Practice</h4><p>Quizzes target your weak topics automatically.</p></div>
          <div class="ms" style="left:93.3%; top:19%"><i>05</i><h4>Build &amp; land</h4><p>Ship real projects &amp; resume-ready proof.</p></div>
        </div>
      </div>
    </section>

    <!-- ===================== AGENTS ===================== -->
    <section class="section agents" id="agents">
      <div class="wrap">
        <div class="agents-head reveal">
          <span class="kicker">The orchestra</span>
          <h2>Not one chatbot.<br />A team of <span class="grad-green">specialist agents.</span></h2>
          <p class="lead">
            An orchestrator reads your intent, loads your profile &amp; context, then routes you to the
            right specialist — and streams the answer back.
          </p>
        </div>

        <div class="agent-grid">
          @for (a of agents; track a.id) {
            <article class="agent-card reveal" [attr.data-d]="a.d" [attr.data-accent]="a.accent" [class.soon]="a.soon">
              <span class="agent-id mono">{{ a.id }}</span>
              <div class="agent-glyph" [attr.data-g]="a.g"></div>
              <h3>{{ a.title }} @if (a.soon) {<span class="soon-tag">soon</span>}</h3>
              <p>{{ a.desc }}</p>
            </article>
          }
        </div>
      </div>
    </section>

    <!-- ===================== PRODUCT FEATURES ===================== -->
    <section class="section product dark" id="product">
      <div class="wrap">
        <div class="feat-head reveal">
          <span class="kicker">The platform</span>
          <h2>Everything a mentor does —<br />always on, made for you.</h2>
        </div>
      </div>

      <!-- Feature 1: Tutor chat -->
      <div class="wrap feat-row reveal">
        <div class="feat-copy">
          <span class="feat-num mono">01 / Tutor</span>
          <h3>An AI tutor that adapts to how you learn.</h3>
          <p>Ask anything and switch modes mid-conversation. Streaming answers, markdown &amp; code blocks,
          and a memory of where you are in your roadmap.</p>
          <ul class="feat-list">
            <li>6 learning modes</li><li>Streaming responses</li><li>Code &amp; markdown</li><li>Context-aware</li>
          </ul>
          <a routerLink="/app/tutor" class="btn btn-ghost">Open the tutor <span class="arrow">→</span></a>
        </div>
        <div class="feat-vis">
          <div class="mini-chat card">
            <div class="mc-top">
              <span class="mc-dot"></span><span class="mc-dot"></span><span class="mc-dot"></span>
              <span class="mc-mode mono">socratic mode</span>
            </div>
            <div class="mc-body" #mcBody>
              <div class="mc-msg user">Why does my React list need a <code>key</code>?</div>
              <div class="mc-msg ai">
                <span class="mc-avatar">A</span>
                <div><p>&nbsp;</p><span class="mc-cursor"></span></div>
              </div>
            </div>
            <div class="mc-input"><span class="mono">message Asta…</span><span class="mc-send">↑</span></div>
          </div>
        </div>
      </div>

      <!-- Feature 2: Roadmap -->
      <div class="wrap feat-row reverse reveal">
        <div class="feat-copy">
          <span class="feat-num mono">02 / Roadmap</span>
          <h3>A living plan, not a static syllabus.</h3>
          <p>Tell Asta your goal and available hours. It generates modules, a weekly cadence, daily tasks and
          assessment checkpoints — then adapts as you progress.</p>
          <ul class="feat-list">
            <li>Week-by-week plan</li><li>Daily tasks</li><li>Milestones</li><li>Auto-adapts</li>
          </ul>
          <a routerLink="/app/roadmap" class="btn btn-ghost">View a roadmap <span class="arrow">→</span></a>
        </div>
        <div class="feat-vis">
          <div class="mini-roadmap card">
            <div class="mr-head"><b>MERN Developer</b><span class="mono">12 weeks · 2h/day</span></div>
            <div class="mr-track">
              <div class="mr-week done"><i></i><span>W1 · JS Foundations</span><b class="mono">100%</b></div>
              <div class="mr-week done"><i></i><span>W2 · React Core</span><b class="mono">100%</b></div>
              <div class="mr-week now"><i></i><span>W3 · Hooks &amp; State</span><b class="mono">60%</b></div>
              <div class="mr-week"><i></i><span>W4 · Node &amp; Express</span><b class="mono">—</b></div>
              <div class="mr-week"><i></i><span>W5 · MongoDB &amp; Mongoose</span><b class="mono">—</b></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Feature 3: trio -->
      <div class="wrap feat-trio">
        <div class="trio-card card reveal" data-accent="peri">
          <div class="agent-glyph sm" data-g="rag"></div>
          <h4>Ask your own notes</h4>
          <p>Upload PDFs &amp; notes. Asta answers only from them — with cited source chunks.</p>
          <a routerLink="/app/knowledge" class="trio-link mono">knowledge base →</a>
        </div>
        <div class="trio-card card reveal" data-d="1" data-accent="green">
          <div class="agent-glyph sm" data-g="assess"></div>
          <h4>Quiz your weak spots</h4>
          <p>Targeted MCQs &amp; short answers, graded instantly, feeding your weak-area map.</p>
          <a routerLink="/app/quizzes" class="trio-link mono">quizzes →</a>
        </div>
        <div class="trio-card card reveal" data-d="2" data-accent="coral">
          <div class="agent-glyph sm" data-g="project"></div>
          <h4>Build portfolio proof</h4>
          <p>Full project blueprints with tasks, schema &amp; resume bullets you can actually ship.</p>
          <a routerLink="/app/projects" class="trio-link mono">projects →</a>
        </div>
      </div>
    </section>

    <!-- ===================== PROOF / STATS ===================== -->
    <section class="section proof" id="proof">
      <div class="wrap">
        <div class="stats">
          <div class="stat reveal"><b class="count" astaCountUp [to]="93">0</b><span class="suffix">%</span><p>finish their first roadmap module</p></div>
          <div class="stat reveal" data-d="1"><b class="count" astaCountUp [to]="6">0</b><span class="suffix">×</span><p>faster doubt resolution vs. searching</p></div>
          <div class="stat reveal" data-d="2"><b class="count" astaCountUp [to]="40">0</b><span class="suffix">k+</span><p>practice questions generated</p></div>
          <div class="stat reveal" data-d="3"><b class="count" astaCountUp [to]="8">0</b><span class="suffix"></span><p>agents working as one mentor</p></div>
        </div>

        <figure class="quote card reveal" astaTilt [tiltMax]="4">
          <blockquote>“It felt like having a senior who actually had time for me. The roadmap kept me honest, and
          the tutor never made me feel dumb for asking.”</blockquote>
          <figcaption>
            <span class="q-avatar slot" style="aspect-ratio:1; width:48px; height:48px; border-radius:50%">photo</span>
            <span><b>Aarav N.</b><i>2nd-year CSE → MERN intern</i></span>
          </figcaption>
        </figure>
      </div>
    </section>

    <!-- ===================== CTA ===================== -->
    <section class="cta dark">
      <div class="cta-glow" aria-hidden="true"></div>
      <div class="wrap cta-inner reveal">
        <span class="kicker center" style="justify-content:center">Your move</span>
        <h2 class="cta-h">Start where you are.<br />Asta maps the rest.</h2>
        <p>Tell us your goal. In two minutes you'll have a roadmap and a mentor that never logs off.</p>
        <div class="hero-actions" style="justify-content:center">
          <a class="btn btn-accent" astaMagnetic role="button" tabindex="0" (click)="goStart()" (keyup.enter)="goStart()">Build my roadmap free <span class="arrow">→</span></a>
          <a routerLink="/login" class="btn btn-ghost">Explore a demo</a>
        </div>
      </div>
    </section>

    <!-- ===================== FOOTER ===================== -->
    <footer class="footer dark">
      <div class="wrap footer-inner">
        <div class="footer-brand">
          <a class="logo" routerLink="/"><asta-logo [size]="26" [onDark]="true" /></a>
          <p class="footer-tag">Your AI skill mentor.<br />Rewiring how people learn to ship.</p>
        </div>
        <div class="footer-cols">
          <div><h5>Platform</h5><a routerLink="/app/dashboard">Dashboard</a><a routerLink="/app/tutor">AI Tutor</a><a routerLink="/app/roadmap">Roadmap</a><a routerLink="/app/knowledge">Knowledge Base</a></div>
          <div><h5>Learn</h5><a routerLink="/app/quizzes">Quizzes</a><a routerLink="/app/projects">Projects</a><a routerLink="/app/progress">Progress</a><a href="#agents" (click)="scrollTo('agents', $event)">Agents</a></div>
          <div><h5>Company</h5><a href="#journey" (click)="scrollTo('journey', $event)">The Path</a><a href="#proof" (click)="scrollTo('proof', $event)">Outcomes</a><a routerLink="/login">For educators</a></div>
        </div>
      </div>
      <div class="wrap footer-base mono">
        <span>© 2026 Asta Edu AI</span>
        <span>Designed as an AI-native learning OS</span>
      </div>
    </footer>
  `,
    styles: [landingStyles]
})
export class LandingComponent implements AfterViewInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly zone = inject(NgZone);

  readonly scrolled = signal(false);

  readonly outcomes = [
    'MERN Developer', 'Java Full-Stack', 'DevOps Engineer', 'Data Analyst',
    'Frontend Interview Prep', 'AI / ML Projects', 'Cloud & AWS',
  ];

  readonly agents = [
    { id: 'a1', g: 'roadmap', accent: 'green', title: 'Roadmap Agent', d: null, soon: false, desc: 'Turns a goal into a timeline, modules, weekly plans, milestones & checkpoints.' },
    { id: 'a2', g: 'tutor', accent: 'peri', title: 'Tutor Agent', d: '1', soon: false, desc: 'Explains in 6 modes — Explain, Hint, Socratic, Practice, Interview, Revision.' },
    { id: 'a3', g: 'doubt', accent: 'coral', title: 'Doubt Solver', d: '2', soon: false, desc: 'Unsticks you fast with focused, step-by-step problem walkthroughs.' },
    { id: 'a4', g: 'rag', accent: 'peri', title: 'Knowledge (RAG)', d: null, soon: false, desc: 'Answers strictly from your uploaded notes & PDFs — with cited sources.' },
    { id: 'a5', g: 'assess', accent: 'green', title: 'Assessment Agent', d: '1', soon: false, desc: 'Generates quizzes, grades answers & pinpoints your weak areas.' },
    { id: 'a6', g: 'project', accent: 'coral', title: 'Project Builder', d: '2', soon: false, desc: 'Designs full project plans — schema, routes, tasks, resume bullets.' },
    { id: 'a7', g: 'career', accent: 'green', title: 'Career Agent', d: null, soon: false, desc: 'Maps skills to roles, preps interviews & connects you to mentors.' },
    { id: 'a8', g: 'insight', accent: 'peri', title: 'Admin Insight', d: '1', soon: false, desc: 'Surfaces cohort trends, usage & content gaps for educators.' },
  ];

  private cleanups: Array<() => void> = [];
  private get reduce(): boolean {
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      this.initNav();
      this.initReveal();
      this.initJourneyPath();
      if (!this.reduce) {
        this.initHeroTilt();
        this.initStreamingChat();
      }
    });
  }

  // ---- nav scroll-blur ----
  private initNav(): void {
    const onScroll = () => this.zone.run(() => this.scrolled.set(window.scrollY > 30));
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    this.cleanups.push(() => window.removeEventListener('scroll', onScroll));
  }

  // ---- generic reveal-on-enter ----
  private initReveal(): void {
    const els = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.reveal'));
    if (this.reduce || typeof IntersectionObserver === 'undefined') {
      els.forEach((e) => e.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      }),
      { threshold: 0.16, rootMargin: '0px 0px -8% 0px' },
    );
    els.forEach((e) => io.observe(e));
    this.cleanups.push(() => io.disconnect());
  }

  // ---- scroll-drawn journey path + milestone pops ----
  private initJourneyPath(): void {
    const root = this.host.nativeElement;
    const progress = this.refPath();
    const stage = root.querySelector<HTMLElement>('.path-stage');
    const milestones = Array.from(root.querySelectorAll<HTMLElement>('.milestones .ms'));
    if (!progress || !stage) return;
    const len = progress.getTotalLength();
    progress.style.strokeDasharray = `${len}`;
    progress.style.strokeDashoffset = `${len}`;
    const draw = () => {
      const r = stage.getBoundingClientRect();
      const vh = window.innerHeight;
      let p = (vh * 0.85 - r.top) / (r.height + vh * 0.5);
      p = Math.max(0, Math.min(1, p));
      progress.style.strokeDashoffset = `${len * (1 - p)}`;
      milestones.forEach((m, i) => {
        const trigger = (i + 0.5) / milestones.length;
        m.classList.toggle('in', p >= trigger * 0.92);
      });
    };
    draw();
    window.addEventListener('scroll', draw, { passive: true });
    window.addEventListener('resize', draw);
    this.cleanups.push(() => { window.removeEventListener('scroll', draw); window.removeEventListener('resize', draw); });
  }

  private refPath(): SVGPathElement | null {
    return this.host.nativeElement.querySelector<SVGPathElement>('.path-svg path[stroke="var(--green)"]')
      ?? this.host.nativeElement.querySelectorAll<SVGPathElement>('.path-svg path')[1] ?? null;
  }

  // ---- hero isometric tilt + scroll parallax ----
  private initHeroTilt(): void {
    const root = this.host.nativeElement;
    const iso = root.querySelector<HTMLElement>('.iso');
    const heroVis = root.querySelector<HTMLElement>('.hero-visual');
    if (!iso || !heroVis) return;
    let raf: number | null = null, tx = 0, ty = 0, cx = 0, cy = 0;
    const loop = () => {
      cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
      iso.style.transform = `rotateX(${54 - cy * 8}deg) rotateZ(${-42 + cx * 8}deg)`;
      raf = (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) ? requestAnimationFrame(loop) : null;
    };
    const onMove = (e: PointerEvent) => {
      const r = heroVis.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const onLeave = () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(loop); };
    const onScroll = () => {
      const r = heroVis.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      heroVis.style.transform = `translateY(${(r.top - window.innerHeight * 0.4) * -0.04}px)`;
    };
    heroVis.addEventListener('pointermove', onMove);
    heroVis.addEventListener('pointerleave', onLeave);
    window.addEventListener('scroll', onScroll, { passive: true });
    this.cleanups.push(() => {
      heroVis.removeEventListener('pointermove', onMove);
      heroVis.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    });
  }

  // ---- looping streaming chat demo ----
  private initStreamingChat(): void {
    const body = this.host.nativeElement.querySelector<HTMLElement>('.mc-body');
    if (!body) return;
    const aiDiv = body.querySelector<HTMLElement>('.mc-msg.ai > div');
    const cursor = body.querySelector<HTMLElement>('.mc-cursor');
    const p = aiDiv?.querySelector('p');
    if (!aiDiv || !cursor || !p) return;
    const full = "Good — let's reason it out. When React re-renders the list, how do you think it decides which item changed?";
    let i = 0, dir = 1, timer: ReturnType<typeof setTimeout> | null = null;
    const type = () => {
      i += dir;
      if (i >= full.length) { dir = -1; timer = setTimeout(type, 2400); return; }
      if (i <= 0) { dir = 1; timer = setTimeout(type, 700); return; }
      p.innerHTML = full.slice(0, i);
      p.appendChild(cursor);
      timer = setTimeout(type, dir > 0 ? 26 + Math.random() * 40 : 12);
    };
    const start = () => { if (!timer) type(); };
    const stop = () => { if (timer) { clearTimeout(timer); timer = null; } };
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => (e.isIntersecting ? start() : stop())),
      { threshold: 0.3 },
    );
    io.observe(body);
    this.cleanups.push(() => { stop(); io.disconnect(); });
  }

  // ---- helpers ----
  scrollTo(id: string, ev: Event): void {
    ev.preventDefault();
    const el = this.host.nativeElement.querySelector(`#${id}`);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 64;
    window.scrollTo({ top: y, behavior: this.reduce ? 'auto' : 'smooth' });
  }

  goStart(): void {
    const user = this.auth.user();
    if (user) void this.router.navigateByUrl(this.auth.postAuthRoute(user));
    else void this.router.navigate(['/register']);
  }

  ngOnDestroy(): void {
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
  }
}
