import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OrgContextService } from '../../core/services/org-context.service';
import { OrgService } from '../../core/services/org.service';
import { ToastService } from '../../core/services/toast.service';
import { ASSIGNABLE_ORG_ROLES, OrgMember, OrgRole, PERM } from '../../core/models';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { RevealDirective } from '../../shared/directives/reveal.directive';
import { TiltDirective } from '../../shared/directives/tilt.directive';

type Tab = 'overview' | 'members' | 'settings';

@Component({
  selector: 'asta-org-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonComponent, CardComponent, EmptyStateComponent, RevealDirective, TiltDirective],
  template: `
    <!-- Command header -->
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Organization</h1>
        <span class="goal-pill"><span class="dot"></span>Manage your workspace, members &amp; settings</span>
      </div>
      @if (ctx.orgs().length > 1) {
        <select class="input shrink-0" style="max-width:240px" [ngModel]="ctx.activeOrgId()" (ngModelChange)="switch($event)">
          @for (o of ctx.orgs(); track o.id) { <option [value]="o.id">{{ o.name }} · {{ o.orgRole }}</option> }
        </select>
      }
    </header>

    @if (!active(); as _) {
      <asta-card>
        <asta-empty-state title="No organization yet" description="Create one to invite members and run cohorts — you'll be its admin.">
          <div class="flex items-end gap-2 justify-center">
            <input class="input" style="max-width:260px" placeholder="Organization name" [(ngModel)]="newOrgName" />
            <asta-btn variant="accent" size="sm" [loading]="creating()" [disabled]="newOrgName.trim().length < 2" (click)="createOrg()">Create</asta-btn>
          </div>
        </asta-empty-state>
      </asta-card>
    } @else {
      @if (active(); as org) {
        <div class="flex gap-2 mb-5">
          @for (t of tabs; track t) { <button class="tab" [class.tab-on]="tab() === t" (click)="tab.set(t)">{{ t }}</button> }
        </div>

        @switch (tab()) {
          @case ('overview') {
            <div class="grid gap-5 md:grid-cols-3">
              <asta-card class="md:col-span-2" [astaReveal]="0">
                <p class="kicker mb-2">{{ org.type }}</p>
                <h2 class="text-[20px] mb-1">{{ org.name }}</h2>
                <p class="text-sm text-txt-soft mb-3">{{ org.description || 'No description yet.' }}</p>
                <div class="flex flex-wrap gap-1.5">
                  <span class="pill">{{ org.memberCount }} members</span>
                  <span class="pill">plan: {{ org.plan }}</span>
                  <span class="pill">your role: {{ ctx.context()?.orgRole }}</span>
                </div>
              </asta-card>
              <asta-card astaTilt [tiltMax]="4" [astaReveal]="1">
                <p class="kicker mb-3">Your access</p>
                <ul class="text-sm text-txt-soft space-y-1">
                  @for (p of ctx.permissions(); track p) { <li class="flex gap-2"><span style="color:var(--green-deep)">✓</span>{{ p }}</li> }
                  @if (ctx.permissions().length === 0) { <li class="text-txt-mute">No special permissions in this org.</li> }
                </ul>
              </asta-card>
            </div>
            <div class="mt-5">
              <input class="input" style="max-width:260px;display:inline-block" placeholder="New organization name" [(ngModel)]="newOrgName" />
              <asta-btn variant="ghost" size="sm" class="ml-2" [loading]="creating()" [disabled]="newOrgName.trim().length < 2" (click)="createOrg()">+ Create another org</asta-btn>
            </div>
          }

          @case ('members') {
            @if (canViewMembers()) {
              <asta-card>
                @if (canManage()) {
                  <div class="flex flex-wrap items-end gap-2 mb-4">
                    <input class="input" style="max-width:240px" placeholder="member@email.com" [(ngModel)]="inviteEmail" />
                    <select class="input" style="max-width:150px" [(ngModel)]="inviteRole">
                      @for (r of roles; track r) { <option [value]="r">{{ r }}</option> }
                    </select>
                    <asta-btn variant="accent" size="sm" [loading]="inviting()" [disabled]="!inviteEmail.includes('@')" (click)="addMember()">Add member</asta-btn>
                  </div>
                }
                @if (members().length === 0) { <p class="text-sm text-txt-mute py-4 text-center">No members yet.</p> }
                <div class="space-y-2">
                  @for (m of members(); track m.userId) {
                    <div class="row">
                      <div class="min-w-0">
                        <p class="text-sm font-medium truncate">{{ m.name }}</p>
                        <p class="text-[11px] text-txt-mute truncate">{{ m.email }}</p>
                      </div>
                      <div class="flex items-center gap-2">
                        @if (canManage()) {
                          <select class="input" style="padding:4px 8px;font-size:12px" [ngModel]="m.orgRole" (ngModelChange)="changeRole(m, $event)">
                            @for (r of roles; track r) { <option [value]="r">{{ r }}</option> }
                          </select>
                          <button class="rm" title="Remove" (click)="remove(m)">✕</button>
                        } @else {
                          <span class="pill">{{ m.orgRole }}</span>
                        }
                      </div>
                    </div>
                  }
                </div>
              </asta-card>
            } @else {
              <asta-card><p class="text-sm text-txt-mute py-6 text-center">You don't have permission to view members in this organization.</p></asta-card>
            }
          }

          @case ('settings') {
            @if (canManage()) {
              <asta-card>
                <p class="kicker mb-3">Organization settings</p>
                <div class="space-y-3" style="max-width:480px">
                  <label class="block"><span class="text-[12px] text-txt-mute">Name</span><input class="input" [(ngModel)]="form.name" /></label>
                  <label class="block"><span class="text-[12px] text-txt-mute">Description</span><textarea class="input" rows="2" [(ngModel)]="form.description"></textarea></label>
                  <label class="block"><span class="text-[12px] text-txt-mute">Tagline</span><input class="input" [(ngModel)]="form.tagline" /></label>
                  <label class="block"><span class="text-[12px] text-txt-mute">Brand color</span><input class="input" type="text" placeholder="#16a34a" [(ngModel)]="form.primaryColor" /></label>
                  <asta-btn variant="accent" size="sm" [loading]="saving()" (click)="saveSettings()">Save changes</asta-btn>
                </div>
              </asta-card>
            } @else {
              <asta-card><p class="text-sm text-txt-mute py-6 text-center">Only org admins can edit settings.</p></asta-card>
            }
          }
        }
      }
    }
  `,
  styles: [
    `
      .tab { font-size: 13px; text-transform: capitalize; padding: 6px 14px; border-radius: 100px; border: 1px solid var(--paper-3); background: var(--paper); color: var(--text-soft); }
      .tab-on { background: var(--ink); color: var(--paper); border-color: var(--ink); }
      .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; border: 1px solid var(--paper-3); border-radius: 12px; padding: 10px 14px; }
      .rm { width: 26px; height: 26px; border-radius: 8px; border: 1px solid var(--paper-3); color: var(--coral-deep); }
      .rm:hover { border-color: var(--coral); }
    `,
  ],
})
export class OrgAdminComponent implements OnInit {
  readonly ctx = inject(OrgContextService);
  private readonly orgApi = inject(OrgService);
  private readonly toast = inject(ToastService);

  readonly tabs: Tab[] = ['overview', 'members', 'settings'];
  readonly roles = ASSIGNABLE_ORG_ROLES;
  readonly tab = signal<Tab>('overview');
  readonly members = signal<OrgMember[]>([]);
  readonly creating = signal(false);
  readonly inviting = signal(false);
  readonly saving = signal(false);

  newOrgName = '';
  inviteEmail = '';
  inviteRole: OrgRole = 'student';
  form = { name: '', description: '', tagline: '', primaryColor: '' };

  readonly active = computed(() => this.ctx.activeOrg());
  readonly canManage = computed(() => this.ctx.has(PERM.OrgManage) || this.ctx.has(PERM.MemberManage));
  readonly canViewMembers = computed(() => this.ctx.has(PERM.StudentView) || this.ctx.has(PERM.MemberManage));

  ngOnInit(): void {
    if (!this.ctx.loaded()) this.ctx.load();
    this.syncForm();
    this.loadMembers();
  }

  switch(id: string): void {
    this.ctx.switchOrg(id);
    setTimeout(() => {
      this.syncForm();
      this.loadMembers();
    }, 150);
  }

  private syncForm(): void {
    const o = this.active();
    if (o) this.form = { name: o.name, description: o.description, tagline: o.branding.tagline, primaryColor: o.branding.primaryColor };
  }

  private loadMembers(): void {
    const o = this.active();
    if (!o || !this.canViewMembers()) return;
    this.orgApi.members(o.id).subscribe({ next: (m) => this.members.set(m), error: () => undefined });
  }

  createOrg(): void {
    if (this.newOrgName.trim().length < 2) return;
    this.creating.set(true);
    this.orgApi.create(this.newOrgName.trim()).subscribe({
      next: (org) => {
        this.creating.set(false);
        this.newOrgName = '';
        this.toast.success('Organization created');
        this.ctx.load();
        setTimeout(() => this.ctx.switchOrg(org.id), 200);
      },
      error: (e) => {
        this.creating.set(false);
        this.toast.error(e?.message ?? 'Could not create organization');
      },
    });
  }

  addMember(): void {
    const o = this.active();
    if (!o) return;
    this.inviting.set(true);
    this.orgApi.addMember(o.id, this.inviteEmail.trim(), this.inviteRole).subscribe({
      next: () => {
        this.inviting.set(false);
        this.inviteEmail = '';
        this.toast.success('Member added');
        this.loadMembers();
      },
      error: (e) => {
        this.inviting.set(false);
        this.toast.error(e?.message ?? 'Could not add member');
      },
    });
  }

  changeRole(m: OrgMember, role: OrgRole): void {
    const o = this.active();
    if (!o) return;
    this.orgApi.updateMemberRole(o.id, m.userId, role).subscribe({
      next: () => this.toast.success(`${m.name} is now ${role}`),
      error: (e) => this.toast.error(e?.message ?? 'Could not update role'),
    });
  }

  remove(m: OrgMember): void {
    const o = this.active();
    if (!o) return;
    this.orgApi.removeMember(o.id, m.userId).subscribe({
      next: () => {
        this.toast.success('Member removed');
        this.loadMembers();
      },
      error: (e) => this.toast.error(e?.message ?? 'Could not remove member'),
    });
  }

  saveSettings(): void {
    const o = this.active();
    if (!o) return;
    this.saving.set(true);
    this.orgApi.update(o.id, this.form).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Settings saved');
        this.ctx.load();
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(e?.message ?? 'Could not save');
      },
    });
  }
}
