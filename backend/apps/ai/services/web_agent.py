"""Web-agent ishlarini boshlash va holatini yangilash (api.py faqat shu funksiyalarni chaqiradi)."""
from ..models import WebAgentRun
from .tinyfish_service import TinyFishService, validate_public_url

ACTIVE_STATUSES = {WebAgentRun.Status.PENDING, WebAgentRun.Status.RUNNING}


def start_web_agent(user, task, url=None):
    """URL bo'lsa sayt avtomatizatsiyasi, bo'lmasa web tadqiqot.

    Noto'g'ri yoki ichki URL — ValueError; provayder xatosi — TinyFishError.
    """
    service = TinyFishService()
    if url:
        url = validate_public_url(url)
        provider_kind = WebAgentRun.ProviderKind.AUTOMATION
        provider_run_id = service.navigate(url, task)
    else:
        provider_kind = WebAgentRun.ProviderKind.RESEARCH
        provider_run_id = service.research(task)
    return WebAgentRun.objects.create(
        created_by=user,
        task=task,
        url=url,
        provider_kind=provider_kind,
        provider_run_id=provider_run_id,
    )


def refresh_run(run):
    """Tugallanmagan ishning holati va natijasini provayderdan olib saqlaydi. Xato — TinyFishError."""
    if run.status not in ACTIVE_STATUSES:
        return run
    provider_task = TinyFishService().get_task_status(run.provider_kind, run.provider_run_id)
    run.status = provider_task.status
    run.result = provider_task.result
    run.error = provider_task.error or ""
    run.save(update_fields=["status", "result", "error", "updated_at"])
    return run
