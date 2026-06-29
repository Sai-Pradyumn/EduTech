import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

/**
 * Brands every browser-tab title. Angular's default TitleStrategy sets the bare
 * route `title` ("Dashboard", "Voice Room", "Page not found"), which drops the
 * product name on every in-app page — only the landing page kept the brand. This
 * appends "· Asta" to any declared route title and falls back to the full brand
 * string for routes that declare none.
 */
@Injectable({ providedIn: 'root' })
export class AstaTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  private static readonly BRAND = 'Asta';
  private static readonly DEFAULT = 'Asta — AI Skill Mentor';

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const pageTitle = this.buildTitle(snapshot);
    this.title.setTitle(
      pageTitle
        ? `${pageTitle} · ${AstaTitleStrategy.BRAND}`
        : AstaTitleStrategy.DEFAULT,
    );
  }
}
