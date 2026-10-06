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
from .services.tinyfish_service import TinyFishError
from .services.web_agent import refresh_run, start_web_agent

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
        data = serializer.validated_data
        try:
            run = start_web_agent(request.user, data["task"], data.get("url"))
        except ValueError as exc:
            raise ValidationError({"url": str(exc)}) from exc
        except TinyFishError as exc:
            logger.warning("TinyFish ishini boshlash amalga oshmadi: %s", exc.reason or type(exc).__name__)
            return Response({"detail": exc.user_message}, status=exc.status_code)
        return Response(WebAgentRunSerializer(run).data, status=status.HTTP_202_ACCEPTED)

    def get(self, request, pk):
        run = get_object_or_404(WebAgentRun, pk=pk, created_by=request.user)
        try:
            run = refresh_run(run)
        except TinyFishError as exc:
            logger.warning("TinyFish holati olinmadi: run=%s reason=%s", run.pk, exc.reason or type(exc).__name__)
            return Response({"detail": exc.user_message}, status=exc.status_code)
        return Response(WebAgentRunSerializer(run).data)
