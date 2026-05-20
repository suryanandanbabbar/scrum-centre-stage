import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import {
  Priority,
  ScrumDatabase,
  ScrumProject,
  ScrumSubtask,
  ScrumTask,
  TeamMember,
  WorkItemBase,
  WorkStatus,
} from './models';

const STORAGE_KEY = 'scrum-centre-stage.database.v1';
const SEED_URL = 'db/scrum.json';

@Injectable({ providedIn: 'root' })
export class ScrumDataService {
  private readonly http = inject(HttpClient);

  load(): Observable<ScrumDatabase> {
    const cached = this.readLocal();

    if (cached) {
      return of(this.normalize(cached));
    }

    return this.http.get<ScrumDatabase>(SEED_URL).pipe(
      map((database) => this.normalize(database)),
      catchError(() => of(this.normalize(this.emptyDatabase()))),
    );
  }

  resetToSeed(): Observable<ScrumDatabase> {
    this.clearLocal();

    return this.http.get<ScrumDatabase>(SEED_URL).pipe(
      map((database) => this.normalize(database)),
      catchError(() => of(this.normalize(this.emptyDatabase()))),
    );
  }

  save(database: ScrumDatabase): ScrumDatabase {
    const normalized = this.normalize({
      ...database,
      updatedAt: new Date().toISOString(),
    });

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized, null, 2));
    } catch {
      // Local persistence is best effort for static deployments.
    }

    return normalized;
  }

  exportJson(database: ScrumDatabase): string {
    return JSON.stringify(this.normalize(database), null, 2);
  }

  normalize(database: ScrumDatabase): ScrumDatabase {
    const fallbackMember = database.teamMembers?.[0]?.id ?? '';

    return {
      version: database.version || 1,
      updatedAt: database.updatedAt || new Date().toISOString(),
      teamMembers: (database.teamMembers ?? []).map((member) => ({
        id: member.id,
        name: member.name || 'New teammate',
        role: member.role || 'Team member',
        email: member.email || '',
        capacity: Number(member.capacity || 5),
        accent: member.accent || '#007aff',
        active: member.active !== false,
      })),
      projects: (database.projects ?? []).map((project) =>
        this.normalizeProject(project, fallbackMember),
      ),
    };
  }

  private normalizeProject(project: ScrumProject, fallbackMember: string): ScrumProject {
    return {
      ...this.normalizeWorkItem(project, fallbackMember),
      summary: project.summary || '',
      tasks: (project.tasks ?? []).map((task) => this.normalizeTask(task, fallbackMember)),
    };
  }

  private normalizeTask(task: ScrumTask, fallbackMember: string): ScrumTask {
    return {
      ...this.normalizeWorkItem(task, fallbackMember),
      description: task.description || '',
      subtasks: (task.subtasks ?? []).map((subtask) =>
        this.normalizeSubtask(subtask, fallbackMember),
      ),
    };
  }

  private normalizeSubtask(subtask: ScrumSubtask, fallbackMember: string): ScrumSubtask {
    return {
      ...this.normalizeWorkItem(subtask, fallbackMember),
      notes: subtask.notes || '',
    };
  }

  private normalizeWorkItem<T extends WorkItemBase>(item: T, fallbackMember: string): T {
    const status = this.asStatus(item.status);
    const normalized = {
      ...item,
      title: item.title || 'Untitled',
      priority: this.asPriority(item.priority),
      startDate: item.startDate || this.today(),
      deadline: item.deadline || item.startDate || this.today(),
      assigneeId: item.assigneeId || fallbackMember,
      status,
    };

    return {
      ...normalized,
      overdue: this.isOverdue(normalized),
    } as T;
  }

  private asPriority(priority: string): Priority {
    return ['Critical', 'High', 'Medium', 'Low'].includes(priority)
      ? (priority as Priority)
      : 'Medium';
  }

  private asStatus(status: string): WorkStatus {
    return ['Backlog', 'Ready', 'In Progress', 'Review', 'Done'].includes(status)
      ? (status as WorkStatus)
      : 'Backlog';
  }

  private isOverdue(item: Pick<WorkItemBase, 'deadline' | 'status'>): boolean {
    if (!item.deadline || item.status === 'Done') {
      return false;
    }

    return this.dateValue(item.deadline) < this.dateValue(this.today());
  }

  private readLocal(): ScrumDatabase | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      return raw ? (JSON.parse(raw) as ScrumDatabase) : null;
    } catch {
      return null;
    }
  }

  private clearLocal(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage failures in locked-down browsers.
    }
  }

  private emptyDatabase(): ScrumDatabase {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      teamMembers: [],
      projects: [],
    };
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private dateValue(value: string): number {
    return new Date(`${value}T00:00:00`).getTime();
  }
}
