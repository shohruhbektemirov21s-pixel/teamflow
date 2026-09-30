import re

with open('backend/apps/tasks/serializers.py', 'r', encoding='utf-8') as f:
    text = f.read()
if 'code =' not in text:
    text = text.replace('class TaskListSerializer(serializers.ModelSerializer):', 'class TaskListSerializer(serializers.ModelSerializer):\n    code = serializers.SerializerMethodField()\n    def get_code(self, obj):\n        return f"TSK-{obj.id}"')
    text = text.replace('class TaskDetailSerializer(serializers.ModelSerializer):', 'class TaskDetailSerializer(serializers.ModelSerializer):\n    code = serializers.SerializerMethodField()\n    def get_code(self, obj):\n        return f"TSK-{obj.id}"')
    text = text.replace('fields = ["id", ', 'fields = ["id", "code", ')
    with open('backend/apps/tasks/serializers.py', 'w', encoding='utf-8') as f:
        f.write(text)

with open('backend/apps/projects/serializers.py', 'r', encoding='utf-8') as f:
    text = f.read()
if 'code =' not in text:
    text = text.replace('class ProjectListSerializer(serializers.ModelSerializer):', 'class ProjectListSerializer(serializers.ModelSerializer):\n    code = serializers.SerializerMethodField()\n    def get_code(self, obj):\n        return f"PRJ-{obj.id}"')
    text = text.replace('class ProjectDetailSerializer(serializers.ModelSerializer):', 'class ProjectDetailSerializer(serializers.ModelSerializer):\n    code = serializers.SerializerMethodField()\n    def get_code(self, obj):\n        return f"PRJ-{obj.id}"')
    text = text.replace('fields = ["id", ', 'fields = ["id", "code", ')
    with open('backend/apps/projects/serializers.py', 'w', encoding='utf-8') as f:
        f.write(text)

# Now filters
with open('backend/apps/tasks/filters.py', 'r', encoding='utf-8') as f:
    text = f.read()
if 're.match' not in text:
    text = text.replace('if params.get("q"):', 'if params.get("q"):\n        import re\n        m = re.match(r"^(?:TSK|PRJ)-?(\d+)$", params["q"].strip(), re.I)\n        if m:\n            return qs.filter(id=m.group(1))\n')
    with open('backend/apps/tasks/filters.py', 'w', encoding='utf-8') as f:
        f.write(text)

with open('backend/apps/projects/api.py', 'r', encoding='utf-8') as f:
    text = f.read()
if 're.match' not in text:
    text = text.replace('if params.get("q"):', 'if params.get("q"):\n            import re\n            m = re.match(r"^PRJ-?(\d+)$", params["q"].strip(), re.I)\n            if m:\n                qs = qs.filter(id=m.group(1))\n            else:\n')
    text = text.replace('qs = qs.filter(name__icontains=params["q"])', '    qs = qs.filter(name__icontains=params["q"])')
    with open('backend/apps/projects/api.py', 'w', encoding='utf-8') as f:
        f.write(text)

