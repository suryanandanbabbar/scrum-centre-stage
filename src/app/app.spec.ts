import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { App } from './app';
import { ScrumDatabase } from './models';
import { ScrumDataService } from './scrum-data.service';

describe('App', () => {
  const database: ScrumDatabase = {
    version: 1,
    updatedAt: '2026-05-20T09:00:00.000Z',
    teamMembers: [
      {
        id: 'member-1',
        name: 'Test Owner',
        role: 'Product owner',
        email: 'owner@example.com',
        capacity: 6,
        accent: '#007aff',
        active: true,
      },
    ],
    projects: [
      {
        id: 'project-1',
        title: 'Demo Sprint',
        summary: 'A seeded project',
        priority: 'High',
        startDate: '2026-05-20',
        deadline: '2026-05-24',
        overdue: false,
        assigneeId: 'member-1',
        status: 'In Progress',
        tasks: [],
      },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        {
          provide: ScrumDataService,
          useValue: {
            load: () => of(database),
            resetToSeed: () => of(database),
            save: (value: ScrumDatabase) => value,
            exportJson: (value: ScrumDatabase) => JSON.stringify(value),
            normalize: (value: ScrumDatabase) => value,
          },
        },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the selected project', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Demo Sprint');
  });
});
