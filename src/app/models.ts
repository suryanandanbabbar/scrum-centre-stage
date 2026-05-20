export type Priority = 'Critical' | 'High' | 'Medium' | 'Low';

export type WorkStatus = 'Backlog' | 'Ready' | 'In Progress' | 'Review' | 'Done';

export type WorkScope = 'project' | 'task' | 'subtask';

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string;
  capacity: number;
  accent: string;
  active: boolean;
}

export interface WorkItemBase {
  id: string;
  title: string;
  priority: Priority;
  startDate: string;
  deadline: string;
  overdue: boolean;
  assigneeId: string;
  status: WorkStatus;
}

export interface ScrumSubtask extends WorkItemBase {
  notes: string;
}

export interface ScrumTask extends WorkItemBase {
  description: string;
  subtasks: ScrumSubtask[];
}

export interface ScrumProject extends WorkItemBase {
  summary: string;
  tasks: ScrumTask[];
}

export interface ScrumDatabase {
  version: number;
  updatedAt: string;
  teamMembers: TeamMember[];
  projects: ScrumProject[];
}

export interface TimelineRow extends WorkItemBase {
  scope: WorkScope;
  projectId: string;
  taskId?: string;
  depth: number;
}

export interface MinimalTaskEntry {
  task: ScrumTask;
  subtasks: ScrumSubtask[];
}

export interface MinimalMemberGroup {
  member: TeamMember;
  entries: MinimalTaskEntry[];
}

export interface MinimalProjectGroup {
  project: ScrumProject;
  members: MinimalMemberGroup[];
}

export interface MatrixCell {
  memberId: string;
  projectId: string;
  open: number;
  overdue: number;
  critical: number;
}
