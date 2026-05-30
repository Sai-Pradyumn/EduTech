import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LogoComponent } from '../../shared/ui/logo.component';

/** Split-screen auth shell: ink panel + form column (DESIGN_SPEC §6.2). */
@Component({
  selector: 'asta-auth-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, LogoComponent],
  template: `
    <div class="min-h-screen grid lg:grid-cols-2">
      <!-- Ink panel with the path motif -->
      <div class="relative hidden lg:flex flex-col justify-between p-10 text-onink overflow-hidden" style="background:var(--ink)">
        <asta-logo [onDark]="true" [size]="32" />
        <div class="relative z-10 max-w-md">
          <p class="kicker mb-4" style="color:var(--green)">AI-native learning OS</p>
          <h2 class="text-onink" style="font-size:clamp(30px,3.4vw,44px);line-height:1.12">
            Learning is a long &amp; winding road. We turn it into a path.
          </h2>
          <p class="text-onink-soft mt-4 text-[17px]">
            A personalized roadmap, an AI tutor, doubt-solving from your own notes, quizzes, and
            real projects — orchestrated by agents that know your goal.
          </p>
        </div>
        <svg class="absolute -right-10 bottom-0 w-[120%] opacity-40" viewBox="0 0 500 300" fill="none" aria-hidden="true">
          <path d="M-20 280 C120 280, 160 60, 320 60 S 520 20, 520 20"
            stroke="var(--green)" stroke-width="2" stroke-dasharray="6 8" stroke-linecap="round" />
        </svg>
      </div>

      <!-- Form column -->
      <div class="flex items-center justify-center p-6 sm:p-10">
        <div class="w-full" style="max-width:400px">
          <div class="lg:hidden mb-8"><asta-logo [size]="30" /></div>
          <router-outlet />
        </div>
      </div>
    </div>
  `,
})
export class AuthLayoutComponent {}
