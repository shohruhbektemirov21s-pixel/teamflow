from django.db.models import Count, Q, Subquery, OuterRef, CharField
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import mixins, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api_utils import require_manager, api_exception_handler
from .models import Suggestion, SuggestionVote
from .serializers import (
    SuggestionListSerializer, SuggestionDetailSerializer, 
    SuggestionCreateSerializer, VoteSerializer, DecideSerializer
)

class SuggestionViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin,
                        mixins.DestroyModelMixin, viewsets.GenericViewSet):
    def get_queryset(self):
        user = self.request.user
        my_vote_subquery = SuggestionVote.objects.filter(
            suggestion=OuterRef("pk"),
            voter=user
        ).values("kind")[:1]

        qs = Suggestion.objects.annotate(
            votes_for=Count("votes", filter=Q(votes__kind=SuggestionVote.Kind.FOR)),
            votes_against=Count("votes", filter=Q(votes__kind=SuggestionVote.Kind.AGAINST)),
            my_vote=Subquery(my_vote_subquery, output_field=CharField())
        ).select_related("author", "decided_by")

        status_param = self.request.query_params.get("status")
        if status_param in [Suggestion.Status.PENDING, Suggestion.Status.ACCEPTED, Suggestion.Status.REJECTED]:
            qs = qs.filter(status=status_param)

        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return SuggestionListSerializer
        elif self.action in ["create"]:
            return SuggestionCreateSerializer
        return SuggestionDetailSerializer

    def create(self, request, *args, **kwargs):
        serializer = SuggestionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        is_anonymous = serializer.validated_data.get("is_anonymous", False)
        author = None if is_anonymous else request.user

        suggestion = Suggestion.objects.create(
            title=serializer.validated_data["title"],
            body=serializer.validated_data["body"],
            is_anonymous=is_anonymous,
            author=author,
        )
        
        # return detailed object
        self.kwargs["pk"] = suggestion.pk
        detail_serializer = SuggestionDetailSerializer(
            self.get_queryset().get(pk=suggestion.pk), 
            context={"request": request}
        )
        return Response(detail_serializer.data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status != Suggestion.Status.PENDING:
            return Response({"detail": "Faqat kutilayotgan takliflarni o'chirish mumkin."}, status=status.HTTP_400_BAD_REQUEST)
        
        if instance.is_anonymous or instance.author != request.user:
            return Response({"detail": "Faqat o'zingiz yozgan va anonim bo'lmagan takliflarni o'chira olasiz."}, status=status.HTTP_403_FORBIDDEN)
            
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def vote(self, request, pk=None):
        suggestion = self.get_object()
        
        if suggestion.status != Suggestion.Status.PENDING:
            return Response({"detail": "Faqat kutilayotgan takliflarga ovoz berish mumkin."}, status=status.HTTP_400_BAD_REQUEST)
            
        if suggestion.author == request.user and not suggestion.is_anonymous:
            return Response({"detail": "O'z taklifingizga ovoz bera olmaysiz."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = VoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        kind = serializer.validated_data["kind"]

        SuggestionVote.objects.update_or_create(
            suggestion=suggestion,
            voter=request.user,
            defaults={"kind": kind}
        )
        
        detail_serializer = SuggestionDetailSerializer(
            self.get_queryset().get(pk=suggestion.pk), 
            context={"request": request}
        )
        return Response(detail_serializer.data)

    @action(detail=True, methods=["delete"])
    def remove_vote(self, request, pk=None):
        suggestion = self.get_object()
        
        if suggestion.status != Suggestion.Status.PENDING:
            return Response({"detail": "Faqat kutilayotgan takliflardagi ovozni o'chirish mumkin."}, status=status.HTTP_400_BAD_REQUEST)
            
        SuggestionVote.objects.filter(suggestion=suggestion, voter=request.user).delete()
        
        detail_serializer = SuggestionDetailSerializer(
            self.get_queryset().get(pk=suggestion.pk), 
            context={"request": request}
        )
        return Response(detail_serializer.data)

    @action(detail=True, methods=["post"])
    def decide(self, request, pk=None):
        if not request.user.is_boss:
            return Response({"detail": "Sizda bunday huquq yo'q."}, status=status.HTTP_403_FORBIDDEN)
            
        suggestion = self.get_object()
        if suggestion.status != Suggestion.Status.PENDING:
            return Response({"detail": "Bu taklif allaqachon ko'rib chiqilgan."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = DecideSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        suggestion.status = serializer.validated_data["status"]
        suggestion.boss_note = serializer.validated_data.get("boss_note", "")
        suggestion.decided_by = request.user
        suggestion.decided_at = timezone.now()
        suggestion.save()

        detail_serializer = SuggestionDetailSerializer(
            self.get_queryset().get(pk=suggestion.pk), 
            context={"request": request}
        )
        return Response(detail_serializer.data)
