import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Real 404 page (production-readiness backlog). Previously `**` silently
 * redirected to the landing page, which made broken/stale links indistinguishable
 * from "logged out". Standalone full-bleed Noir surface — works for both public
 * and authed visitors; offers the two useful exits instead of guessing.
 */
@Component({
  selector: 'asta-not-found',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="nf-root">
      <div class="nf-card card" role="alert" aria-labelledby="nf-title">
        <p class="kicker">PAGE NOT FOUND</p>
        <p class="nf-code grad-flow" aria-hidden="true">404</p>
        <h1 id="nf-title" class="nf-title">This path isn't on your map.</h1>
        <p class="nf-sub">
          The link may be stale, mistyped, or the page may have moved.
          Your learning data is untouched — pick a way back.
        </p>
        <div class="nf-actions">
          <a routerLink="/app/dashboard" class="nf-btn nf-btn-accent">Go to dashboard <span class="arr">→</span></a>
          <a routerLink="/" class="nf-btn nf-btn-ghost">Back to home</a>
        </div>
      </div>
    </main>
  `,
  styles: [
    `
      .nf-root {
        min-height: 100dvh;
        display: grid;
        place-items: center;
        padding: 24px;
        background: var(--paper, #0b0f0d);
      }
      .nf-card {
        max-width: 460px;
        width: 100%;
        padding: 40px 36px;
        text-align: center;
      }
      .nf-code {
        font-size: 84px;
        font-weight: 700;
        line-height: 1;
        margin: 18px 0 6px;
        letter-spacing: -0.02em;
      }
      .nf-title {
        font-size: 22px;
        font-weight: 600;
        margin: 0 0 10px;
      }
      .nf-sub {
        color: var(--text-muted, #8a948f);
        font-size: 14px;
        line-height: 1.6;
        margin: 0 0 26px;
      }
      .nf-actions {
        display: flex;
        gap: 12px;
        justify-content: center;
        flex-wrap: wrap;
      }
      .nf-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 10px 20px;
        border-radius: 999px;
        font-size: 14px;
        font-weight: 600;
        text-decoration: none;
        transition: transform 0.25s var(--ease-spring, ease), box-shadow 0.25s ease;
      }
      .nf-btn:hover {
        transform: translateY(-1px);
      }
      .nf-btn:focus-visible {
        outline: 2px solid var(--green, #2fbf8f);
        outline-offset: 2px;
      }
      .nf-btn-accent {
        background: var(--green, #2fbf8f);
        color: var(--paper, #0b0f0d);
      }
      .nf-btn-accent:hover {
        box-shadow: 0 6px 22px color-mix(in oklch, var(--green, #2fbf8f) 35%, transparent);
      }
      .nf-btn-ghost {
        color: var(--text, #e8ece9);
        border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
      }
    `,
  ],
})
export class NotFoundComponent {}
