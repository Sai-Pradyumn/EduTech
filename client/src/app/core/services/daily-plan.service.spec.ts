import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DAILY_KIND_GLYPH, DailyItemKind, DailyPlanService } from './daily-plan.service';

describe('DailyPlanService', () => {
  let svc: DailyPlanService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    svc = TestBed.inject(DailyPlanService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('reorder() POSTs itemIds to /daily-plan/reorder', () => {
    svc.reorder(['a', 'b']).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/daily-plan/reorder'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ itemIds: ['a', 'b'] });
    req.flush({ success: true, data: {} });
  });

  it('setItemNote() POSTs the itemId + note', () => {
    svc.setItemNote('item1', 'remember this').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/daily-plan/item-note'));
    expect(req.request.body).toEqual({ itemId: 'item1', note: 'remember this' });
    req.flush({ success: true, data: {} });
  });

  it('history() GETs with the days query param', () => {
    svc.history(14).subscribe();
    const req = http.expectOne(
      (r) => r.url.endsWith('/daily-plan/history') && r.params.get('days') === '14',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: [] });
  });
});

describe('DAILY_KIND_GLYPH', () => {
  it('has a glyph for every daily item kind', () => {
    const kinds: DailyItemKind[] = ['flow_node', 'mistake', 'quiz', 'revision', 'project'];
    for (const k of kinds) expect(DAILY_KIND_GLYPH[k]).toBeTruthy();
  });
});
