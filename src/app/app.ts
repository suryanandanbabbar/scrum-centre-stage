import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucideCalendarClock,
  LucideChartGantt,
  LucideCheck,
  LucideChevronRight,
  LucideCircleAlert,
  LucideCircleCheck,
  LucideDownload,
  LucideFileJson,
  LucideFolderKanban,
  LucideKanban,
  LucideLayoutDashboard,
  LucideListChecks,
  LucideListTree,
  LucidePanelLeft,
  LucidePencil,
  LucidePlus,
  LucideRefreshCw,
  LucideSave,
  LucideSearch,
  LucideSquarePlus,
  LucideTrash2,
  LucideUpload,
  LucideUserPlus,
  LucideUsers,
  LucideX,
} from '@lucide/angular';

import {
  MatrixCell,
  MinimalProjectGroup,
  Priority,
  ScrumDatabase,
  ScrumProject,
  ScrumSubtask,
  ScrumTask,
  TeamMember,
  TimelineRow,
  WorkItemBase,
  WorkStatus,
} from './models';
import { ScrumDataService } from './scrum-data.service';

type ViewMode = 'kanban' | 'timeline' | 'matrix' | 'minimal';
type EditorType = 'project' | 'task' | 'subtask' | 'member';
type EditorMode = 'create' | 'edit';
type EditorContext = {
  projectId?: string;
  taskId?: string;
  itemId?: string;
};
type EditorDraft = Record<string, string | number | boolean | ScrumTask[] | ScrumSubtask[]>;

const EMPTY_DATABASE: ScrumDatabase = {
  version: 1,
  updatedAt: '',
  teamMembers: [],
  projects: [],
};

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    FormsModule,
    LucideCalendarClock,
    LucideChartGantt,
    LucideCheck,
    LucideChevronRight,
    LucideCircleAlert,
    LucideCircleCheck,
    LucideDownload,
    LucideFileJson,
    LucideFolderKanban,
    LucideKanban,
    LucideLayoutDashboard,
    LucideListChecks,
    LucideListTree,
    LucidePanelLeft,
    LucidePencil,
    LucidePlus,
    LucideRefreshCw,
    LucideSave,
    LucideSearch,
    LucideSquarePlus,
    LucideTrash2,
    LucideUpload,
    LucideUserPlus,
    LucideUsers,
    LucideX,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected readonly statuses: WorkStatus[] = ['Backlog', 'Ready', 'In Progress', 'Review', 'Done'];
  protected readonly priorities: Priority[] = ['Critical', 'High', 'Medium', 'Low'];
  protected readonly accents = ['#007aff', '#34c759', '#ff9500', '#ff3b30', '#af52de', '#5ac8fa'];
  protected readonly viewModes: Array<{ mode: ViewMode; label: string }> = [
    { mode: 'kanban', label: 'Kanban' },
    { mode: 'timeline', label: 'Timeline' },
    { mode: 'matrix', label: 'Matrix' },
    { mode: 'minimal', label: 'Minimal' },
  ];

  protected readonly database = signal<ScrumDatabase>(EMPTY_DATABASE);
  protected readonly selectedProjectId = signal('');
  protected readonly viewMode = signal<ViewMode>('kanban');
  protected readonly searchTerm = signal('');
  protected readonly assigneeFilter = signal('all');
  protected readonly sidebarOpen = signal(true);
  protected readonly inspectorOpen = signal(false);
  protected readonly editorType = signal<EditorType>('task');
  protected readonly editorMode = signal<EditorMode>('create');
  protected readonly editorContext = signal<EditorContext>({});
  protected readonly isLoading = signal(true);

  protected draft: EditorDraft = {};

  private readonly dataService = inject(ScrumDataService);

  protected readonly teamMembers = computed(() => this.database().teamMembers);
  protected readonly projects = computed(() => this.database().projects);
  protected readonly activeMembers = computed(() => this.teamMembers().filter((member) => member.active));

  protected readonly selectedProject = computed(() => {
    const selectedId = this.selectedProjectId();

    return this.projects().find((project) => project.id === selectedId) ?? this.projects()[0];
  });

  protected readonly selectedProjectStats = computed(() => {
    const project = this.selectedProject();

    if (!project) {
      return { total: 0, done: 0, overdue: 0, progress: 0 };
    }

    const taskItems = project.tasks.flatMap((task) => [task, ...task.subtasks]);
    const total = taskItems.length;
    const done = taskItems.filter((item) => item.status === 'Done').length;
    const overdue = taskItems.filter((item) => this.isOverdue(item)).length;

    return {
      total,
      done,
      overdue,
      progress: total ? Math.round((done / total) * 100) : 0,
    };
  });

  protected readonly visibleTasks = computed(() => {
    const project = this.selectedProject();

    if (!project) {
      return [];
    }

    const query = this.searchTerm().trim().toLowerCase();
    const assigneeId = this.assigneeFilter();

    return project.tasks.filter((task) => {
      const text = `${task.title} ${task.description} ${task.subtasks
        .map((subtask) => `${subtask.title} ${subtask.notes}`)
        .join(' ')}`.toLowerCase();
      const matchesSearch = !query || text.includes(query);
      const matchesAssignee =
        assigneeId === 'all' ||
        task.assigneeId === assigneeId ||
        task.subtasks.some((subtask) => subtask.assigneeId === assigneeId);

      return matchesSearch && matchesAssignee;
    });
  });

  protected readonly kanbanColumns = computed(() =>
    this.statuses.map((status) => ({
      status,
      tasks: this.visibleTasks().filter((task) => task.status === status),
    })),
  );

  protected readonly timelineRows = computed<TimelineRow[]>(() => {
    const project = this.selectedProject();

    if (!project) {
      return [];
    }

    return this.visibleTasks().flatMap((task) => [
      {
        ...task,
        scope: 'task' as const,
        projectId: project.id,
        taskId: task.id,
        depth: 0,
      },
      ...task.subtasks.map((subtask) => ({
        ...subtask,
        scope: 'subtask' as const,
        projectId: project.id,
        taskId: task.id,
        depth: 1,
      })),
    ]);
  });

  protected readonly timelineDays = computed(() => {
    const project = this.selectedProject();
    const rows = this.timelineRows();

    if (!project) {
      return [];
    }

    const allDates = [project.startDate, project.deadline, ...rows.flatMap((row) => [row.startDate, row.deadline])];
    const start = Math.min(...allDates.map((date) => this.dateValue(date)));
    const end = Math.max(...allDates.map((date) => this.dateValue(date)));
    const days: string[] = [];

    for (let current = start; current <= end; current += 86_400_000) {
      days.push(new Date(current).toISOString().slice(0, 10));
    }

    return days;
  });

  protected readonly minimalGroups = computed<MinimalProjectGroup[]>(() =>
    this.projects().map((project) => ({
      project,
      members: this.teamMembers().map((member) => ({
        member,
        entries: project.tasks
          .map((task) => {
            const taskBelongsToMember = task.assigneeId === member.id;
            const subtasks = taskBelongsToMember
              ? task.subtasks
              : task.subtasks.filter((subtask) => subtask.assigneeId === member.id);

            return {
              task,
              subtasks,
            };
          })
          .filter((entry) => entry.task.assigneeId === member.id || entry.subtasks.length > 0),
      })),
    })),
  );

  protected readonly matrixCells = computed<MatrixCell[]>(() =>
    this.teamMembers().flatMap((member) =>
      this.projects().map((project) => {
        const items = project.tasks.flatMap((task) => [task, ...task.subtasks]).filter((item) => item.assigneeId === member.id);

        return {
          memberId: member.id,
          projectId: project.id,
          open: items.filter((item) => item.status !== 'Done').length,
          overdue: items.filter((item) => this.isOverdue(item)).length,
          critical: items.filter((item) => item.priority === 'Critical').length,
        };
      }),
    ),
  );

  protected readonly editorTitle = computed(() => {
    const mode = this.editorMode() === 'create' ? 'New' : 'Edit';
    const noun: Record<EditorType, string> = {
      project: 'Project',
      task: 'Task',
      subtask: 'Subtask',
      member: 'Member',
    };

    return `${mode} ${noun[this.editorType()]}`;
  });

  ngOnInit(): void {
    this.dataService.load().subscribe((database) => {
      this.database.set(database);
      this.selectedProjectId.set(database.projects[0]?.id ?? '');
      this.isLoading.set(false);
    });
  }

  protected selectProject(projectId: string): void {
    this.selectedProjectId.set(projectId);
  }

  protected setView(mode: ViewMode): void {
    this.viewMode.set(mode);
  }

  protected openProjectEditor(project?: ScrumProject): void {
    this.editorType.set('project');
    this.editorMode.set(project ? 'edit' : 'create');
    this.editorContext.set({ itemId: project?.id });
    this.draft = project
      ? { ...project, tasks: project.tasks }
      : this.defaultWorkDraft('New project', this.selectedProject()?.assigneeId);
    this.inspectorOpen.set(true);
  }

  protected openTaskEditor(projectId: string, task?: ScrumTask): void {
    this.editorType.set('task');
    this.editorMode.set(task ? 'edit' : 'create');
    this.editorContext.set({ projectId, itemId: task?.id });
    this.draft = task
      ? { ...task, subtasks: task.subtasks }
      : {
          ...this.defaultWorkDraft('New task', this.selectedProject()?.assigneeId),
          description: '',
          subtasks: [],
        };
    this.inspectorOpen.set(true);
  }

  protected openSubtaskEditor(projectId: string, taskId: string, subtask?: ScrumSubtask): void {
    this.editorType.set('subtask');
    this.editorMode.set(subtask ? 'edit' : 'create');
    this.editorContext.set({ projectId, taskId, itemId: subtask?.id });
    this.draft = subtask
      ? { ...subtask }
      : {
          ...this.defaultWorkDraft('New subtask', this.findTask(projectId, taskId)?.assigneeId),
          notes: '',
        };
    this.inspectorOpen.set(true);
  }

  protected openMemberEditor(member?: TeamMember): void {
    this.editorType.set('member');
    this.editorMode.set(member ? 'edit' : 'create');
    this.editorContext.set({ itemId: member?.id });
    this.draft = member
      ? { ...member }
      : {
          id: this.createId('member'),
          name: 'New teammate',
          role: 'Team member',
          email: '',
          capacity: 6,
          accent: this.accents[this.teamMembers().length % this.accents.length],
          active: true,
        };
    this.inspectorOpen.set(true);
  }

  protected closeInspector(): void {
    this.inspectorOpen.set(false);
  }

  protected saveEditor(): void {
    const type = this.editorType();
    const mode = this.editorMode();
    const context = this.editorContext();
    const database = this.cloneDatabase();

    if (type === 'project') {
      const project = this.projectFromDraft(mode === 'edit' ? String(context.itemId) : this.createId('project'));

      if (mode === 'edit') {
        database.projects = database.projects.map((current) =>
          current.id === project.id ? { ...project, tasks: current.tasks } : current,
        );
      } else {
        database.projects = [...database.projects, { ...project, tasks: [] }];
        this.selectedProjectId.set(project.id);
      }
    }

    if (type === 'task' && context.projectId) {
      const task = this.taskFromDraft(mode === 'edit' ? String(context.itemId) : this.createId('task'));

      database.projects = database.projects.map((project) =>
        project.id === context.projectId
          ? {
              ...project,
              tasks:
                mode === 'edit'
                  ? project.tasks.map((current) => (current.id === task.id ? { ...task, subtasks: current.subtasks } : current))
                  : [...project.tasks, { ...task, subtasks: [] }],
            }
          : project,
      );
    }

    if (type === 'subtask' && context.projectId && context.taskId) {
      const subtask = this.subtaskFromDraft(mode === 'edit' ? String(context.itemId) : this.createId('subtask'));

      database.projects = database.projects.map((project) =>
        project.id === context.projectId
          ? {
              ...project,
              tasks: project.tasks.map((task) =>
                task.id === context.taskId
                  ? {
                      ...task,
                      subtasks:
                        mode === 'edit'
                          ? task.subtasks.map((current) => (current.id === subtask.id ? subtask : current))
                          : [...task.subtasks, subtask],
                    }
                  : task,
              ),
            }
          : project,
      );
    }

    if (type === 'member') {
      const member = this.memberFromDraft(mode === 'edit' ? String(context.itemId) : this.createId('member'));

      database.teamMembers =
        mode === 'edit'
          ? database.teamMembers.map((current) => (current.id === member.id ? member : current))
          : [...database.teamMembers, member];
    }

    this.persist(database);
    this.inspectorOpen.set(false);
  }

  protected deleteProject(projectId: string): void {
    if (!confirm('Delete this project and its tasks?')) {
      return;
    }

    const database = this.cloneDatabase();
    database.projects = database.projects.filter((project) => project.id !== projectId);
    this.selectedProjectId.set(database.projects[0]?.id ?? '');
    this.persist(database);
  }

  protected deleteTask(projectId: string, taskId: string): void {
    if (!confirm('Delete this task and its subtasks?')) {
      return;
    }

    const database = this.cloneDatabase();
    database.projects = database.projects.map((project) =>
      project.id === projectId
        ? { ...project, tasks: project.tasks.filter((task) => task.id !== taskId) }
        : project,
    );
    this.persist(database);
  }

  protected deleteSubtask(projectId: string, taskId: string, subtaskId: string): void {
    if (!confirm('Delete this subtask?')) {
      return;
    }

    const database = this.cloneDatabase();
    database.projects = database.projects.map((project) =>
      project.id === projectId
        ? {
            ...project,
            tasks: project.tasks.map((task) =>
              task.id === taskId
                ? { ...task, subtasks: task.subtasks.filter((subtask) => subtask.id !== subtaskId) }
                : task,
            ),
          }
        : project,
    );
    this.persist(database);
  }

  protected deleteMember(memberId: string): void {
    if (!confirm('Delete this team member? Existing work moves to the first active teammate.')) {
      return;
    }

    const database = this.cloneDatabase();
    const replacementId = database.teamMembers.find((member) => member.id !== memberId && member.active)?.id ?? '';

    database.teamMembers = database.teamMembers.filter((member) => member.id !== memberId);
    database.projects = database.projects.map((project) => ({
      ...this.reassignItem(project, memberId, replacementId),
      tasks: project.tasks.map((task) => ({
        ...this.reassignItem(task, memberId, replacementId),
        subtasks: task.subtasks.map((subtask) => this.reassignItem(subtask, memberId, replacementId)),
      })),
    }));

    if (this.assigneeFilter() === memberId) {
      this.assigneeFilter.set('all');
    }

    this.persist(database);
  }

  protected moveTask(projectId: string, taskId: string, status: WorkStatus): void {
    const database = this.cloneDatabase();
    database.projects = database.projects.map((project) =>
      project.id === projectId
        ? {
            ...project,
            tasks: project.tasks.map((task) => (task.id === taskId ? { ...task, status } : task)),
          }
        : project,
    );
    this.persist(database);
  }

  protected exportDatabase(): void {
    const blob = new Blob([this.dataService.exportJson(this.database())], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'scrum-centre-stage.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  protected importDatabase(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result)) as ScrumDatabase;
        const normalized = this.dataService.normalize(imported);
        this.persist(normalized);
        this.selectedProjectId.set(normalized.projects[0]?.id ?? '');
      } catch {
        alert('That JSON could not be imported.');
      } finally {
        input.value = '';
      }
    };

    reader.readAsText(file);
  }

  protected resetDatabase(): void {
    if (!confirm('Reset to the bundled JSON database?')) {
      return;
    }

    this.isLoading.set(true);
    this.dataService.resetToSeed().subscribe((database) => {
      this.database.set(database);
      this.selectedProjectId.set(database.projects[0]?.id ?? '');
      this.isLoading.set(false);
    });
  }

  protected memberName(memberId: string): string {
    return this.teamMembers().find((member) => member.id === memberId)?.name ?? 'Unassigned';
  }

  protected memberById(memberId: string): TeamMember | undefined {
    return this.teamMembers().find((member) => member.id === memberId);
  }

  protected initials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }

  protected subtasksDone(task: ScrumTask): number {
    return task.subtasks.filter((subtask) => subtask.status === 'Done').length;
  }

  protected isOverdue(item: Pick<WorkItemBase, 'deadline' | 'status'>): boolean {
    if (!item.deadline || item.status === 'Done') {
      return false;
    }

    return this.dateValue(item.deadline) < this.dateValue(this.today());
  }

  protected dueLabel(item: Pick<WorkItemBase, 'deadline' | 'status'>): string {
    if (item.status === 'Done') {
      return 'Done';
    }

    const days = Math.ceil((this.dateValue(item.deadline) - this.dateValue(this.today())) / 86_400_000);

    if (days < 0) {
      return `${Math.abs(days)}d overdue`;
    }

    if (days === 0) {
      return 'Due today';
    }

    return `${days}d left`;
  }

  protected priorityClass(priority: Priority): string {
    return `priority-${priority.toLowerCase()}`;
  }

  protected statusClass(status: WorkStatus): string {
    return `status-${status.toLowerCase().replaceAll(' ', '-')}`;
  }

  protected timelineTemplate(): string {
    return `220px repeat(${this.timelineDays().length}, 34px)`;
  }

  protected timelineTrackTemplate(): string {
    return `repeat(${this.timelineDays().length}, 34px)`;
  }

  protected timelineSpan(row: TimelineRow): string {
    const days = this.timelineDays();
    const start = days[0] ?? row.startDate;
    const offset = Math.max(0, Math.round((this.dateValue(row.startDate) - this.dateValue(start)) / 86_400_000));
    const duration = Math.max(1, Math.round((this.dateValue(row.deadline) - this.dateValue(row.startDate)) / 86_400_000) + 1);

    return `${offset + 1} / span ${duration}`;
  }

  protected matrixCell(memberId: string, projectId: string): MatrixCell {
    return (
      this.matrixCells().find((cell) => cell.memberId === memberId && cell.projectId === projectId) ?? {
        memberId,
        projectId,
        open: 0,
        overdue: 0,
        critical: 0,
      }
    );
  }

  protected openTimelineRow(row: TimelineRow): void {
    if (row.scope === 'task') {
      const task = this.findTask(row.projectId, row.id);

      if (task) {
        this.openTaskEditor(row.projectId, task);
      }

      return;
    }

    if (row.taskId) {
      const subtask = this.findSubtask(row.projectId, row.taskId, row.id);

      if (subtask) {
        this.openSubtaskEditor(row.projectId, row.taskId, subtask);
      }
    }
  }

  protected matrixTemplate(): string {
    return `220px repeat(${Math.max(this.projects().length, 1)}, minmax(160px, 1fr))`;
  }

  protected totalOpenForMember(memberId: string): number {
    return this.matrixCells()
      .filter((cell) => cell.memberId === memberId)
      .reduce((sum, cell) => sum + cell.open, 0);
  }

  private projectFromDraft(id: string): ScrumProject {
    return {
      id,
      title: this.asString(this.draft['title'], 'Untitled project'),
      summary: this.asString(this.draft['summary']),
      priority: this.asPriority(this.draft['priority']),
      startDate: this.asString(this.draft['startDate'], this.today()),
      deadline: this.asString(this.draft['deadline'], this.today()),
      overdue: false,
      assigneeId: this.asString(this.draft['assigneeId'], this.activeMembers()[0]?.id ?? ''),
      status: this.asStatus(this.draft['status']),
      tasks: (this.draft['tasks'] as ScrumTask[]) ?? [],
    };
  }

  private taskFromDraft(id: string): ScrumTask {
    return {
      id,
      title: this.asString(this.draft['title'], 'Untitled task'),
      description: this.asString(this.draft['description']),
      priority: this.asPriority(this.draft['priority']),
      startDate: this.asString(this.draft['startDate'], this.today()),
      deadline: this.asString(this.draft['deadline'], this.today()),
      overdue: false,
      assigneeId: this.asString(this.draft['assigneeId'], this.activeMembers()[0]?.id ?? ''),
      status: this.asStatus(this.draft['status']),
      subtasks: (this.draft['subtasks'] as ScrumSubtask[]) ?? [],
    };
  }

  private subtaskFromDraft(id: string): ScrumSubtask {
    return {
      id,
      title: this.asString(this.draft['title'], 'Untitled subtask'),
      notes: this.asString(this.draft['notes']),
      priority: this.asPriority(this.draft['priority']),
      startDate: this.asString(this.draft['startDate'], this.today()),
      deadline: this.asString(this.draft['deadline'], this.today()),
      overdue: false,
      assigneeId: this.asString(this.draft['assigneeId'], this.activeMembers()[0]?.id ?? ''),
      status: this.asStatus(this.draft['status']),
    };
  }

  private memberFromDraft(id: string): TeamMember {
    return {
      id,
      name: this.asString(this.draft['name'], 'New teammate'),
      role: this.asString(this.draft['role'], 'Team member'),
      email: this.asString(this.draft['email']),
      capacity: Number(this.draft['capacity'] || 6),
      accent: this.asString(this.draft['accent'], '#007aff'),
      active: Boolean(this.draft['active']),
    };
  }

  private defaultWorkDraft(title: string, assigneeId?: string): EditorDraft {
    const today = this.today();

    return {
      id: '',
      title,
      summary: '',
      priority: 'Medium',
      startDate: today,
      deadline: today,
      overdue: false,
      assigneeId: assigneeId || this.activeMembers()[0]?.id || '',
      status: 'Backlog',
    };
  }

  private findTask(projectId: string, taskId: string): ScrumTask | undefined {
    return this.projects()
      .find((project) => project.id === projectId)
      ?.tasks.find((task) => task.id === taskId);
  }

  private findSubtask(projectId: string, taskId: string, subtaskId: string): ScrumSubtask | undefined {
    return this.findTask(projectId, taskId)?.subtasks.find((subtask) => subtask.id === subtaskId);
  }

  private reassignItem<T extends WorkItemBase>(item: T, oldMemberId: string, newMemberId: string): T {
    return item.assigneeId === oldMemberId ? { ...item, assigneeId: newMemberId } : item;
  }

  private persist(database: ScrumDatabase): void {
    const normalized = this.dataService.save(database);
    this.database.set(normalized);
  }

  private cloneDatabase(): ScrumDatabase {
    return structuredClone(this.database());
  }

  private createId(prefix: string): string {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  private asString(value: unknown, fallback = ''): string {
    const text = String(value ?? '').trim();

    return text || fallback;
  }

  private asPriority(value: unknown): Priority {
    return this.priorities.includes(value as Priority) ? (value as Priority) : 'Medium';
  }

  private asStatus(value: unknown): WorkStatus {
    return this.statuses.includes(value as WorkStatus) ? (value as WorkStatus) : 'Backlog';
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private dateValue(value: string): number {
    return new Date(`${value}T00:00:00`).getTime();
  }
}
