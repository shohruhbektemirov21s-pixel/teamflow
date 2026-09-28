import re

with open("backend/apps/tasks/api.py", "r", encoding="utf-8") as f:
    content = f.read()

bulk_method = """
    @action(detail=False, methods=["post"])
    def bulk(self, request):
        project_id = request.data.get("project")
        if not project_id:
            return Response({"project": "Majburiy"}, status=400)
        from apps.projects.models import Project
        from django.shortcuts import get_object_or_404
        project = get_object_or_404(Project, pk=project_id)
        
        titles = request.data.get("titles", [])
        if not titles:
            return Response({"titles": "Vazifa nomlari kiritilmadi"}, status=400)
            
        assignee_ids = request.data.get("assignee_ids", [])
        priority = request.data.get("priority", "medium")
        description = request.data.get("description", "")
        due_at = request.data.get("due_at")
        
        created = []
        for title in titles:
            if not title.strip():
                continue
            task = services.create_task(
                request.user,
                project,
                title=title.strip(),
                description=description,
                priority=priority,
                starts_at=None,
                due_at=due_at,
                assignee_ids=assignee_ids,
            )
            created.append(task)
            
        return Response({"created": len(created)}, status=201)
"""

if "def bulk(" not in content:
    content = content.replace("    def update(", bulk_method + "\n    def update(")
    with open("backend/apps/tasks/api.py", "w", encoding="utf-8") as f:
        f.write(content)
    print("Added bulk method to api.py")
else:
    print("bulk method already exists")
