import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from '../../core/services/i18n.service';
import { TranslationKey } from '../../core/i18n/translations';

/**
 * `{{ 'nav.learn' | t }}` — runtime translation (Phase 4 · B15). Impure so it re-evaluates
 * when the active locale signal changes (the service reads `locale()` inside `t`).
 */
@Pipe({ name: 't', standalone: true, pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: TranslationKey): string {
    // Touch the signal so change detection re-runs this impure pipe on locale change.
    this.i18n.locale();
    return this.i18n.t(key);
  }
}
