/** Scoped landing styles — ported from EduTechDesign/assets/css/{system,landing}.css. */
export const landingStyles = `
  :host { display: block; background: var(--paper); color: var(--text); overflow-x: hidden; }

  /* ---- base helpers (scoped) ---- */
  .wrap { width: 100%; max-width: var(--maxw, 1240px); margin: 0 auto; padding: 0 32px; }
  .section { padding: clamp(80px, 11vh, 150px) 0; position: relative; }
  .dark { background: var(--ink); color: var(--on-ink); }
  .dark h1, .dark h2, .dark h3, .dark h4 { color: var(--on-ink); }
  .mono { font-family: var(--mono); }
  .center { text-align: center; }
  .grad-green { color: transparent; background: linear-gradient(100deg, var(--green-deep), var(--green)); -webkit-background-clip: text; background-clip: text; }
  .reveal { opacity: 0; transform: translateY(26px); transition: opacity .9s var(--ease), transform .9s var(--ease); }
  .reveal.in { opacity: 1; transform: none; }
  .reveal[data-d="1"] { transition-delay: .08s; } .reveal[data-d="2"] { transition-delay: .16s; }
  .reveal[data-d="3"] { transition-delay: .24s; } .reveal[data-d="4"] { transition-delay: .32s; }
  .kicker { font-family: var(--mono); font-size: 12.5px; letter-spacing: .18em; text-transform: uppercase; color: var(--accent-deep); display: inline-flex; align-items: center; gap: 10px; }
  .kicker::before { content: ""; width: 22px; height: 1.5px; background: currentColor; display: inline-block; }
  .dark .kicker { color: var(--green); }
  .pill { font-family: var(--mono); font-size: 12px; letter-spacing: .06em; text-transform: uppercase; padding: 6px 12px; border-radius: 100px; border: 1px solid var(--paper-3); color: var(--text-soft); background: var(--paper); display: inline-flex; align-items: center; gap: 7px; }
  .pill .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--green); }
  .card { background: var(--paper); border: 1px solid var(--paper-3); border-radius: var(--r-lg); box-shadow: var(--shadow-sm); }
  .dark .card { background: var(--ink-2); border-color: var(--ink-3); box-shadow: none; }
  .slot { position: relative; border-radius: var(--r-lg); background: repeating-linear-gradient(135deg, oklch(0.5 0.02 264 / .05) 0 2px, transparent 2px 11px); border: 1px dashed var(--paper-3); display: grid; place-items: center; color: var(--text-mute); font-family: var(--mono); font-size: 12px; letter-spacing: .04em; text-align: center; }

  /* ---- buttons ---- */
  .btn { font-family: var(--body); font-weight: 600; font-size: 16px; letter-spacing: -.01em; padding: 15px 26px; border-radius: 100px; border: 1.5px solid transparent; background: var(--ink); color: var(--paper); cursor: pointer; display: inline-flex; align-items: center; gap: 10px; transition: transform .35s var(--ease-spring), box-shadow .35s var(--ease), background .25s var(--ease), color .25s var(--ease); position: relative; white-space: nowrap; }
  .btn:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
  .btn:active { transform: translateY(0); }
  .btn .arrow { transition: transform .35s var(--ease-spring); }
  .btn:hover .arrow { transform: translateX(4px); }
  .btn-accent { background: var(--green); color: var(--ink); }
  .btn-ghost { background: transparent; color: var(--text); border-color: var(--paper-3); }
  .dark .btn-ghost { color: var(--on-ink); border-color: var(--ink-3); }
  .btn-ghost:hover { background: var(--paper-2); }
  .dark .btn-ghost:hover { background: var(--ink-2); }

  /* ---- NAV ---- */
  .nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; transition: background .4s var(--ease), backdrop-filter .4s, border-color .4s, box-shadow .4s; border-bottom: 1px solid transparent; }
  .nav-inner { display: flex; align-items: center; justify-content: space-between; height: 76px; }
  .nav.scrolled { background: color-mix(in oklch, var(--paper) 80%, transparent); backdrop-filter: blur(18px) saturate(1.4); border-bottom-color: var(--paper-3); box-shadow: 0 1px 0 oklch(1 0 0 / .25) inset; }
  .logo { display: inline-flex; align-items: center; gap: 11px; color: var(--text); transition: transform .5s var(--ease-spring); }
  .logo:hover { transform: rotate(-4deg); }
  .nav-links { display: flex; gap: 34px; }
  .nav-links a { font-size: 15.5px; font-weight: 500; color: var(--text-soft); position: relative; padding: 4px 0; transition: color .25s; white-space: nowrap; }
  .nav-links a::after { content: ""; position: absolute; left: 0; bottom: -2px; height: 2px; width: 0; background: var(--green); transition: width .3s var(--ease); }
  .nav-links a:hover { color: var(--text); }
  .nav-links a:hover::after { width: 100%; }
  .nav-cta { display: flex; align-items: center; gap: 20px; }
  .nav-login { font-size: 15.5px; font-weight: 600; color: var(--text); white-space: nowrap; }
  .nav-login:hover { color: var(--green-deep); }
  .nav-start { padding: 11px 20px; font-size: 15px; }

  /* ---- HERO ---- */
  .hero { position: relative; min-height: 100vh; display: flex; align-items: center; padding-top: 76px; overflow: hidden; background: radial-gradient(120% 90% at 85% 0%, oklch(0.80 0.16 150 / .10), transparent 55%), radial-gradient(90% 80% at 5% 100%, oklch(0.78 0.15 268 / .08), transparent 55%), var(--paper); }
  .hero-path { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1; }
  #heroLine { stroke-dashoffset: 0; animation: dash 14s linear infinite; }
  @keyframes dash { to { stroke-dashoffset: -480; } }
  .hero-inner { display: grid; grid-template-columns: 1.06fr .94fr; gap: 40px; align-items: center; position: relative; z-index: 2; }
  .hero-pill { margin-bottom: 26px; }
  .hero-h1 { font-size: clamp(42px, 5.4vw, 72px); font-weight: 600; line-height: 1.13; font-family: var(--display); letter-spacing: -.025em; }
  .hero-h1 em { font-style: normal; display: block; color: var(--green-deep); margin-top: .04em; }
  .hero-sub { margin: 34px 0 34px; font-size: clamp(17px, 1.5vw, 20px); color: var(--text-soft); max-width: 33ch; line-height: 1.55; }
  .hero-actions { display: flex; gap: 14px; flex-wrap: wrap; }
  .hero-meta { margin-top: 34px; display: flex; align-items: center; gap: 20px; font-size: 15px; color: var(--text-mute); }
  .hero-meta b { font-family: var(--display); color: var(--text); font-size: 20px; margin-right: 3px; }
  .hero-meta .sep { width: 1px; height: 28px; background: var(--paper-3); }
  .hero-visual { position: relative; height: 460px; perspective: 1400px; z-index: 2; }
  .iso { position: absolute; inset: 0; transform-style: preserve-3d; transform: rotateX(54deg) rotateZ(-42deg); transition: transform .3s var(--ease); }
  .iso-plate { position: absolute; border-radius: 22px; border: 1.5px solid var(--paper-3); box-shadow: var(--shadow-md); }
  .iso-plate.p1 { inset: 22% 14% 18% 16%; background: linear-gradient(140deg, var(--paper), var(--paper-2)); }
  .iso-plate.p2 { inset: 10% 22% 30% 24%; transform: translateZ(46px); background: linear-gradient(140deg, oklch(0.80 0.16 150 / .16), oklch(0.80 0.16 150 / .04)); border-color: oklch(0.80 0.16 150 / .4); }
  .iso-plate.p3 { inset: 0% 30% 42% 32%; transform: translateZ(96px); background: var(--ink); border-color: var(--ink-3); }
  .iso-node { position: absolute; width: 14px; height: 14px; transform: translateZ(120px); }
  .iso-node span { position: absolute; inset: 0; border-radius: 50%; background: var(--green); box-shadow: 0 0 0 6px oklch(0.80 0.16 150 / .2); animation: pulse 2.6s var(--ease) infinite; }
  .iso-node.n1 { left: 36%; top: 30%; }
  .iso-node.n2 { left: 58%; top: 44%; } .iso-node.n2 span { background: var(--peri); box-shadow: 0 0 0 6px oklch(0.78 0.15 268 / .2); animation-delay: .8s; }
  .iso-node.n3 { left: 46%; top: 58%; } .iso-node.n3 span { background: var(--coral); box-shadow: 0 0 0 6px oklch(0.78 0.16 38 / .2); animation-delay: 1.4s; }
  @keyframes pulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.4); opacity: .7; } }
  .iso-chip { position: absolute; transform: translateZ(150px) rotateZ(42deg) rotateX(-54deg); background: var(--ink); color: var(--green); font-size: 12px; padding: 7px 12px; border-radius: 9px; border: 1px solid var(--ink-3); box-shadow: var(--shadow-md); white-space: nowrap; }
  .iso-chip.c1 { left: 4%; top: 8%; } .iso-chip.c2 { right: -2%; top: 40%; color: var(--peri); } .iso-chip.c3 { left: 18%; bottom: 4%; color: var(--coral); }
  .scroll-cue { position: absolute; bottom: 28px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 10px; color: var(--text-mute); font-size: 11px; letter-spacing: .14em; text-transform: uppercase; z-index: 3; }
  .scroll-track { width: 22px; height: 36px; border: 1.5px solid var(--paper-3); border-radius: 100px; position: relative; }
  .scroll-dot { position: absolute; top: 6px; left: 50%; transform: translateX(-50%); width: 4px; height: 8px; border-radius: 100px; background: var(--green-deep); animation: scrolldot 1.8s var(--ease) infinite; }
  @keyframes scrolldot { 0% { opacity: 0; top: 6px; } 30% { opacity: 1; } 70% { opacity: 1; } 100% { opacity: 0; top: 20px; } }

  /* ---- MARQUEE ---- */
  .marquee-wrap { background: var(--ink); color: var(--on-ink); padding: 22px 0; overflow: hidden; border-block: 1px solid var(--ink-3); }
  .marquee { display: inline-flex; }
  .marquee-row { display: inline-flex; align-items: center; gap: 30px; white-space: nowrap; font-family: var(--display); font-size: 24px; font-weight: 500; padding-right: 30px; animation: marquee 28s linear infinite; }
  .marquee-row span { color: var(--on-ink); }
  .marquee-row .m-dot { color: var(--green); font-size: 13px; }
  @keyframes marquee { to { transform: translateX(-100%); } }

  /* ---- JOURNEY ---- */
  .journey { overflow: hidden; }
  .journey-head { max-width: 760px; }
  .journey-head h2 { font-size: clamp(34px, 4.6vw, 60px); line-height: 1.12; margin: 22px 0 28px; }
  .lead { font-size: clamp(16px, 1.4vw, 19px); color: var(--text-soft); max-width: 56ch; }
  .dark .lead { color: var(--on-ink-soft); }
  .path-stage { position: relative; margin-top: 60px; max-width: var(--maxw, 1240px); margin-inline: auto; padding: 0 32px; }
  .path-svg { width: 100%; height: auto; overflow: visible; }
  .milestones { position: absolute; inset: 0 32px; }
  .ms { position: absolute; transform: translate(-50%, -50%); width: 190px; opacity: 0; transition: opacity .6s var(--ease), transform .6s var(--ease-spring); }
  .ms.in { opacity: 1; }
  .ms::before { content: ""; position: absolute; left: 50%; top: -34px; transform: translateX(-50%); width: 16px; height: 16px; border-radius: 50%; background: var(--ink); border: 3px solid var(--green); box-shadow: 0 0 0 6px var(--ink); transition: transform .4s var(--ease-spring); }
  .ms.in::before { animation: popNode .5s var(--ease-spring); }
  @keyframes popNode { 0% { transform: translateX(-50%) scale(0); } 70% { transform: translateX(-50%) scale(1.25); } 100% { transform: translateX(-50%) scale(1); } }
  .ms i { font-family: var(--mono); font-style: normal; font-size: 12px; color: var(--green); letter-spacing: .1em; }
  .ms h4 { font-size: 21px; margin: 4px 0 6px; color: var(--on-ink); }
  .ms p { font-size: 14px; color: var(--on-ink-mute); line-height: 1.45; }

  /* ---- AGENTS ---- */
  .agents-head { max-width: 720px; margin-bottom: 56px; }
  .agents-head h2 { font-size: clamp(34px, 4.6vw, 60px); line-height: 1.12; margin: 22px 0 30px; }
  .agent-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
  .agent-card { position: relative; padding: 26px 24px 28px; border-radius: var(--r-lg); background: var(--paper); border: 1px solid var(--paper-3); overflow: hidden; transition: transform .4s var(--ease-spring), box-shadow .4s var(--ease), border-color .4s; cursor: default; }
  .agent-card::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 3px; transform: scaleX(0); transform-origin: left; transition: transform .45s var(--ease); }
  .agent-card[data-accent="green"]::after { background: var(--green); }
  .agent-card[data-accent="peri"]::after { background: var(--peri); }
  .agent-card[data-accent="coral"]::after { background: var(--coral); }
  .agent-card:hover { transform: translateY(-6px); box-shadow: var(--shadow-lg); border-color: transparent; }
  .agent-card:hover::after { transform: scaleX(1); }
  .agent-id { position: absolute; top: 18px; right: 18px; font-size: 11px; color: var(--text-mute); }
  .agent-glyph { width: 52px; height: 52px; margin-bottom: 20px; border-radius: 14px; position: relative; background: var(--paper-2); border: 1px solid var(--paper-3); }
  .agent-card[data-accent="green"] .agent-glyph { background: oklch(0.80 0.16 150 / .12); border-color: oklch(0.80 0.16 150 / .3); }
  .agent-card[data-accent="peri"] .agent-glyph { background: oklch(0.78 0.15 268 / .12); border-color: oklch(0.78 0.15 268 / .3); }
  .agent-card[data-accent="coral"] .agent-glyph { background: oklch(0.78 0.16 38 / .12); border-color: oklch(0.78 0.16 38 / .3); }
  .agent-card h3 { font-size: 20px; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
  .agent-card p { font-size: 14.5px; color: var(--text-soft); line-height: 1.5; }
  .agent-card.soon { opacity: .92; }
  .soon-tag { font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: var(--text-mute); border: 1px solid var(--paper-3); padding: 2px 7px; border-radius: 100px; }
  .agent-glyph::before, .agent-glyph::after { content: ""; position: absolute; }
  .agent-glyph.sm { width: 44px; height: 44px; margin-bottom: 16px; }
  .agent-glyph[data-g="roadmap"]::before { left: 12px; top: 50%; width: 28px; height: 2px; background: var(--green-deep); transform: translateY(-50%) rotate(-28deg); }
  .agent-glyph[data-g="roadmap"]::after { left: 11px; top: 16px; width: 7px; height: 7px; border-radius: 50%; background: var(--green-deep); box-shadow: 19px 16px 0 var(--green-deep); }
  .agent-glyph[data-g="tutor"]::before { inset: 14px; border: 2px solid var(--peri-deep); border-radius: 8px 8px 8px 2px; }
  .agent-glyph[data-g="tutor"]::after { left: 21px; top: 22px; width: 4px; height: 4px; border-radius: 50%; background: var(--peri-deep); box-shadow: 7px 0 0 var(--peri-deep), -7px 0 0 var(--peri-deep); }
  .agent-glyph[data-g="doubt"]::before { inset: 14px; border: 2px solid var(--coral-deep); border-radius: 50%; clip-path: inset(0 0 40% 0); }
  .agent-glyph[data-g="doubt"]::after { left: 50%; bottom: 14px; transform: translateX(-50%); width: 3px; height: 3px; border-radius: 50%; background: var(--coral-deep); box-shadow: 0 0 0 2px var(--coral-deep); }
  .agent-glyph[data-g="rag"]::before { left: 16px; top: 14px; width: 16px; height: 22px; border: 2px solid var(--peri-deep); border-radius: 3px; }
  .agent-glyph[data-g="rag"]::after { left: 22px; top: 19px; width: 14px; height: 2px; background: var(--peri-deep); box-shadow: 0 5px 0 var(--peri-deep), 0 10px 0 var(--peri-deep); }
  .agent-glyph[data-g="assess"]::before { left: 15px; top: 26px; width: 6px; height: 12px; background: var(--green-deep); box-shadow: 10px -6px 0 var(--green-deep), 20px -12px 0 var(--green-deep); }
  .agent-glyph[data-g="project"]::before { left: 16px; top: 16px; width: 9px; height: 9px; border: 2px solid var(--coral-deep); box-shadow: 12px 0 0 var(--coral-deep), 0 12px 0 var(--coral-deep), 12px 12px 0 var(--coral-deep); }
  .agent-glyph[data-g="career"]::before { left: 16px; bottom: 14px; width: 20px; height: 2px; background: var(--green-deep); }
  .agent-glyph[data-g="career"]::after { left: 24px; top: 14px; width: 6px; height: 6px; border-radius: 50%; background: var(--green-deep); box-shadow: -10px 8px 0 var(--green-deep), 10px 4px 0 var(--green-deep); }
  .agent-glyph[data-g="insight"]::before { left: 16px; top: 16px; width: 20px; height: 20px; border: 2px solid var(--peri-deep); border-radius: 50%; clip-path: polygon(0 0, 50% 50%, 100% 0, 100% 100%, 0 100%); }

  /* ---- PRODUCT FEATURES ---- */
  .feat-head { max-width: 720px; margin-bottom: 64px; }
  .feat-head h2 { font-size: clamp(32px, 4.4vw, 56px); line-height: 1.12; margin-top: 20px; }
  .feat-row { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center; padding: 44px 32px; }
  .feat-row.reverse .feat-copy { order: 2; }
  .feat-num { color: var(--green); font-size: 13px; letter-spacing: .08em; }
  .feat-copy h3 { font-size: clamp(26px, 3vw, 38px); line-height: 1.12; margin: 14px 0 22px; color: var(--on-ink); }
  .feat-copy > p { color: var(--on-ink-soft); font-size: 17px; max-width: 44ch; margin-bottom: 22px; }
  .feat-list { list-style: none; display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 28px; padding: 0; }
  .feat-list li { font-size: 13.5px; color: var(--on-ink-soft); border: 1px solid var(--ink-3); padding: 7px 13px; border-radius: 100px; font-family: var(--mono); }
  .feat-list li::before { content: "+ "; color: var(--green); }
  .mini-chat { padding: 0; overflow: hidden; }
  .mc-top { display: flex; align-items: center; gap: 7px; padding: 14px 18px; border-bottom: 1px solid var(--ink-3); }
  .mc-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--ink-3); }
  .mc-mode { margin-left: auto; color: var(--peri); font-size: 11px; }
  .mc-body { padding: 22px 18px; display: flex; flex-direction: column; gap: 16px; min-height: 220px; }
  .mc-msg { font-size: 15px; line-height: 1.5; max-width: 86%; }
  .mc-msg.user { align-self: flex-end; background: var(--green); color: var(--ink); padding: 11px 15px; border-radius: 16px 16px 4px 16px; font-weight: 500; }
  .mc-msg.user code { background: oklch(0.19 0.035 264 / .14); padding: 1px 5px; border-radius: 5px; font-family: var(--mono); font-size: 13px; }
  .mc-msg.ai { align-self: flex-start; display: flex; gap: 11px; color: var(--on-ink-soft); }
  .mc-avatar { flex: none; width: 28px; height: 28px; border-radius: 8px; background: var(--peri); color: var(--ink); display: grid; place-items: center; font-family: var(--display); font-weight: 700; font-size: 14px; }
  .mc-cursor { display: inline-block; width: 8px; height: 16px; background: var(--green); margin-left: 2px; vertical-align: -2px; animation: blink 1s steps(2) infinite; }
  @keyframes blink { 50% { opacity: 0; } }
  .mc-input { display: flex; align-items: center; gap: 10px; margin: 0 14px 14px; padding: 12px 14px; border: 1px solid var(--ink-3); border-radius: 14px; color: var(--on-ink-mute); font-size: 13px; }
  .mc-send { margin-left: auto; width: 28px; height: 28px; border-radius: 8px; background: var(--ink-3); color: var(--on-ink); display: grid; place-items: center; }
  .mini-roadmap { padding: 22px; }
  .mr-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 18px; padding-bottom: 16px; border-bottom: 1px solid var(--ink-3); }
  .mr-head b { font-family: var(--display); font-size: 20px; color: var(--on-ink); }
  .mr-head span { color: var(--on-ink-mute); font-size: 12px; }
  .mr-track { display: flex; flex-direction: column; gap: 4px; }
  .mr-week { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 12px; font-size: 15px; color: var(--on-ink-soft); transition: background .25s; }
  .mr-week i { width: 11px; height: 11px; border-radius: 50%; border: 2px solid var(--ink-3); flex: none; }
  .mr-week b { margin-left: auto; color: var(--on-ink-mute); font-size: 12px; }
  .mr-week.done i { background: var(--green); border-color: var(--green); }
  .mr-week.done b { color: var(--green); }
  .mr-week.now { background: oklch(0.78 0.15 268 / .12); color: var(--on-ink); }
  .mr-week.now i { border-color: var(--peri); box-shadow: 0 0 0 4px oklch(0.78 0.15 268 / .2); }
  .mr-week.now b { color: var(--peri); }
  .feat-trio { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 48px; }
  .trio-card { padding: 28px 26px; border-radius: var(--r-lg); }
  .trio-card h4 { font-size: 21px; color: var(--on-ink); margin-bottom: 8px; }
  .trio-card p { color: var(--on-ink-soft); font-size: 15px; line-height: 1.5; margin-bottom: 18px; }
  .trio-link { color: var(--green); font-size: 13px; transition: letter-spacing .25s; display: inline-flex; }
  .trio-card[data-accent="peri"] .trio-link { color: var(--peri); }
  .trio-card[data-accent="coral"] .trio-link { color: var(--coral); }
  .trio-card:hover .trio-link { letter-spacing: .02em; }

  /* ---- PROOF ---- */
  .proof { background: var(--paper-2); }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; margin-bottom: 70px; }
  .stat { text-align: left; border-left: 2px solid var(--paper-3); padding-left: 20px; }
  .stat b { font-family: var(--display); font-size: clamp(44px, 5vw, 68px); font-weight: 600; line-height: 1; color: var(--text); letter-spacing: -.03em; }
  .stat .suffix { font-family: var(--display); font-size: 32px; color: var(--green-deep); }
  .stat p { margin-top: 10px; color: var(--text-soft); font-size: 14.5px; max-width: 22ch; }
  .quote { max-width: 880px; margin: 0 auto; padding: 44px 48px; }
  .quote blockquote { font-family: var(--display); font-size: clamp(22px, 2.6vw, 32px); line-height: 1.3; letter-spacing: -.02em; color: var(--text); }
  .quote figcaption { margin-top: 28px; display: flex; align-items: center; gap: 14px; }
  .quote figcaption b { display: block; font-size: 16px; }
  .quote figcaption i { font-style: normal; color: var(--text-mute); font-size: 14px; }

  /* ---- CTA ---- */
  .cta { position: relative; padding: clamp(90px, 13vh, 160px) 0; overflow: hidden; text-align: center; }
  .cta-glow { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 800px; height: 800px; border-radius: 50%; background: radial-gradient(circle, oklch(0.80 0.16 150 / .16), transparent 60%); pointer-events: none; }
  .cta-inner { position: relative; z-index: 2; max-width: 760px; margin: 0 auto; }
  .cta-h { font-size: clamp(38px, 5.6vw, 72px); line-height: 1.1; margin: 18px 0 22px; }
  .cta-inner > p { color: var(--on-ink-soft); font-size: 19px; margin-bottom: 34px; }

  /* ---- FOOTER ---- */
  .footer { padding: 70px 0 40px; border-top: 1px solid var(--ink-3); }
  .footer-inner { display: grid; grid-template-columns: 1.4fr 2fr; gap: 40px; padding-bottom: 50px; border-bottom: 1px solid var(--ink-3); }
  .footer-tag { color: var(--on-ink-mute); margin-top: 18px; font-size: 15px; }
  .footer-cols { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
  .footer-cols h5 { font-family: var(--mono); font-size: 12px; text-transform: uppercase; letter-spacing: .1em; color: var(--green); margin-bottom: 16px; font-weight: 500; }
  .footer-cols a { display: block; color: var(--on-ink-soft); font-size: 15px; padding: 6px 0; transition: color .2s, padding-left .2s; }
  .footer-cols a:hover { color: var(--on-ink); padding-left: 5px; }
  .footer-base { display: flex; justify-content: space-between; padding-top: 26px; color: var(--on-ink-mute); font-size: 12px; }

  /* ---- RESPONSIVE ---- */
  @media (max-width: 980px) {
    .nav-links { display: none; }
    .hero-inner { grid-template-columns: 1fr; gap: 10px; }
    .hero-visual { height: 340px; order: -1; }
    .hero-sub { max-width: none; }
    .agent-grid { grid-template-columns: repeat(2, 1fr); }
    .feat-row, .feat-row.reverse { grid-template-columns: 1fr; gap: 32px; }
    .feat-row.reverse .feat-copy { order: 0; }
    .feat-trio { grid-template-columns: 1fr; }
    .stats { grid-template-columns: repeat(2, 1fr); }
    .footer-inner { grid-template-columns: 1fr; }
    .ms { width: 150px; } .ms p { display: none; }
  }
  @media (max-width: 560px) {
    .wrap { padding: 0 20px; }
    .agent-grid { grid-template-columns: 1fr; }
    .stats { grid-template-columns: 1fr; }
    .nav-login { display: none; }
    .footer-cols { grid-template-columns: repeat(2, 1fr); }
    .hero-meta { flex-wrap: wrap; }
    .path-stage { overflow-x: hidden; }
  }
  `;
