with open('frontend/src/features/tasks/TaskModal.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('task.worklog_hours > 0', 'Number(task.worklog_hours) > 0')

text = text.replace('wl.user.id === meta.me?.id', 'wl.user.id === me?.id')
if 'const me = useMe();' not in text:
    text = text.replace('const meta = useMeta();', 'const meta = useMeta();\n  const me = useMe();')

text = text.replace('import { useMeta }', 'import { useMe, useMeta }')

text = text.replace('T.tasks.col.project', '"Loyiha"')
text = text.replace('T.tasks.col.due', '"Muddat"')
text = text.replace('T.tasks.col.assignees', '"Ijrochilar"')

text = text.replace('<Due due={task.due_at} />', '<Due value={task.due_at} />')

text = text.replace('<People users={task.assignments.map((a) => a.developer)} />', '<div className="chips">{task.assignees.map((u) => <Avatar key={u.id} user={u} size="sm" />)}</div>')
text = text.replace('task.actions.manage_files', 'task.actions.add_files')
text = text.replace('import { People }', 'import { People }') 

with open('frontend/src/features/tasks/TaskModal.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
