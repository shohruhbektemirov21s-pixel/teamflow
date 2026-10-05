import logging

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from apps.core.api_utils import IsManager

from .models import WebAgentRun
from .serializers import WebAgentRequestSerializer, WebAgentRunSerializer
from .services.tinyfish_service import TinyFishError, TinyFishService, validate_public_url

logger = logging.getLogger(__name__)


class WebAgentRateThrottle(UserRateThrottle):
    scope = "ai_web_agent"


class WebAgentView(APIView):
    """PM/Boshliq uchun TinyFish web agent ishini yaratish va polling."""

    permission_classes = [IsAuthenticated, IsManager]
    throttle_classes = [WebAgentRateThrottle]

    def post(self, request):
        serializer = WebAgentRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        task = serializer.validated_data["task"]
        url = serializer.validated_data.get("url")
        service = TinyFishService()
        try:
            if url:
                try:
                    url = validate_public_url(url)
                except ValueError as exc:
                    raise ValidationError({"url": str(exc)}) from exc
                provider_kind = WebAgentRun.ProviderKind.AUTOMATION
                provider_run_id = service.navigate(url, task)
            else:
                provider_kind = WebAgentRun.ProviderKind.RESEARCH
                provider_run_id = service.research(task)
        except TinyFishError as exc:
            logger.warning("TinyFish ishini boshlash amalga oshmadi: %s", exc.reason or type(exc).__name__)
            return Response({"detail": exc.user_message}, status=exc.status_code)

        run = WebAgentRun.objects.create(
            created_by=request.user,
            task=task,
            url=url,
            provider_kind=provider_kind,
            provider_run_id=provider_run_id,
        )
        return Response(WebAgentRunSerializer(run).data, status=status.HTTP_202_ACCEPTED)

    def get(self, request, pk):
        run = get_object_or_404(WebAgentRun, pk=pk, created_by=request.user)
        if run.status in {WebAgentRun.Status.PENDING, WebAgentRun.Status.RUNNING}:
            try:
                provider_task = TinyFishService().get_task_status(run.provider_kind, run.provider_run_id)
            except TinyFishError as exc:
                logger.warning("TinyFish holati olinmadi: run=%s reason=%s", run.pk, exc.reason or type(exc).__name__)
                return Response({"detail": exc.user_message}, status=exc.status_code)
            run.status = provider_task.status
            run.result = provider_task.result
            run.error = provider_task.error or ""
            run.save(update_fields=["status", "result", "error", "updated_at"])
        return Response(WebAgentRunSerializer(run).data)

