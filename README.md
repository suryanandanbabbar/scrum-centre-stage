# Scrum Centre Stage

A frontend-only Angular desktop workbench for managing scrum work across projects, tasks, subtasks, deadlines, priorities, assignees, and team members.

## Stack

- Angular 21 standalone application
- JSON seed database in `public/db/scrum.json`
- Browser `localStorage` persistence for create, update, and delete flows
- `@lucide/angular` icons
- Static deployment ready for GitHub Pages

## Views

- Kanban: status lanes with task and subtask controls
- Timeline: Gantt-style schedule view
- Matrix: team-by-project workload and overdue view
- Minimal: sequential project, teammate, task, and subtask list

## Local Development

```bash
npm install
npm start
```

Open `http://localhost:4200/`.

## Build

```bash
npm run build
```

For GitHub Pages under a repository path:

```bash
npm run build -- --base-href /scrum-centre-stage/
```

The production output is written to `dist/scrum-centre-stage/browser`.

## Test

```bash
npm test
```

---

Contributions are appreciated!
