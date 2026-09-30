with open('frontend/src/features/tasks/TaskModal.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('import { useMeta } from "@/shared/meta";', 'import { useMe, useMeta } from "@/shared/meta";')
text = text.replace('import { useMe, useRefresh } from "@/app/queries";', 'import { useRefresh } from "@/app/queries";')

with open('frontend/src/features/tasks/TaskModal.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
