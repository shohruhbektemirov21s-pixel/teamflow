with open('frontend/src/features/tasks/TaskModal.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('import { useRefresh } from "@/app/queries";', 'import { useRefresh } from "@/app/queries";\nimport { useMe } from "@/app/auth";')

# remove unused imports
text = text.replace('CalendarClock,', '')
text = text.replace('ChevronDown,', '')
text = text.replace('Flag,', '')

text = text.replace('const [tab, setTab] = useState<Tab>("main");', '')

with open('frontend/src/features/tasks/TaskModal.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
