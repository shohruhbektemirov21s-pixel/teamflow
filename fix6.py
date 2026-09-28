with open('frontend/src/features/tasks/TaskModal.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('import { useMe, useRefresh } from "@/app/queries";', 'import { useRefresh } from "@/app/queries";')
text = text.replace('type Tab = "main" | "review" | "worklog" | "comments";', '')
text = text.replace('useEffect(() => {\n    if (task?.actions.review && task.status === "in_review") setTab("review");\n  }, [task?.actions.review, task?.status]);', '')

with open('frontend/src/features/tasks/TaskModal.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
