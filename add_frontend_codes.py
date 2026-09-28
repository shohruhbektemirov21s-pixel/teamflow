with open('frontend/src/shared/types.ts', 'r', encoding='utf-8') as f:
    text = f.read()

if 'code: string;' not in text:
    text = text.replace('export interface Task {\n  id: number;', 'export interface Task {\n  id: number;\n  code: string;')
    text = text.replace('export interface TaskDetail extends Task {', 'export interface TaskDetail extends Task {\n  code: string;')
    text = text.replace('export interface Project {\n  id: number;', 'export interface Project {\n  id: number;\n  code: string;')
    text = text.replace('export interface ProjectDetail extends Project {', 'export interface ProjectDetail extends Project {\n  code: string;')
    
    with open('frontend/src/shared/types.ts', 'w', encoding='utf-8') as f:
        f.write(text)

with open('frontend/src/features/tasks/TaskTable.tsx', 'r', encoding='utf-8') as f:
    text = f.read()
if '<span className="muted">{task.code}</span>' not in text:
    text = text.replace('<div>{task.title}</div>', '<div><span className="muted">{task.code}</span> {task.title}</div>')
    with open('frontend/src/features/tasks/TaskTable.tsx', 'w', encoding='utf-8') as f:
        f.write(text)

with open('frontend/src/features/tasks/TaskModal.tsx', 'r', encoding='utf-8') as f:
    text = f.read()
if '{task.code}' not in text:
    text = text.replace('title={task.title}', 'title={<><span className="muted">{task.code}</span> {task.title}</>}')
    with open('frontend/src/features/tasks/TaskModal.tsx', 'w', encoding='utf-8') as f:
        f.write(text)

with open('frontend/src/features/projects/ProjectModal.tsx', 'r', encoding='utf-8') as f:
    text = f.read()
if '{project.code}' not in text:
    text = text.replace('title={project.name}', 'title={<><span className="muted">{project.code}</span> {project.name}</>}')
    with open('frontend/src/features/projects/ProjectModal.tsx', 'w', encoding='utf-8') as f:
        f.write(text)
