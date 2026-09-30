from django.db.models import CharField, Count, OuterRef, Q, Subquery
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from . import services
from .models import Suggestion, SuggestionVote
from .serializers import (
    DecideSerializer,
    SuggestionCreateSerializer,
    SuggestionDetailSerializer,
    SuggestionListSerializer,
    VoteSerializer,
)


class SuggestionViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Takliflar. Tahrirlash yo'q; qaror faqat `decide` orqali (services.decide)."""

    def get_queryset(self):
        my_vote = SuggestionVote.objects.filter(suggestion=OuterRef("pk"), voter=self.request.user).values("kind")[:1]
        qs = Suggestion.objects.annotate(
            votes_for=Count("votes", filter=Q(votes__kind=SuggestionVote.Kind.FOR)),
            votes_against=Count("votes", filter=Q(votes__kind=SuggestionVote.Kind.AGAINST)),
            my_vote=Subquery(my_vote, output_field=CharField()),
        ).select_related("author", "decided_by").order_by("-created_at", "-id")  # Count bilan Meta.ordering qo'llanmaydi
        status_param = self.request.query_params.get("status")
        if status_param in Suggestion.Status.values:
            qs = qs.filter(status=status_param)
        return qs

    def get_serializer_class(self):
        return SuggestionListSerializer if self.action == "list" else SuggestionDetailSerializer

    def _detail(self, suggestion):
        return SuggestionDetailSerializer(self.get_queryset().get(pk=suggestion.pk), context={"request": self.request}).data

    def create(self, request):
        s = SuggestionCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        suggestion = services.create_suggestion(request.user, **s.validated_data)
        return Response(self._detail(suggestion), status=status.HTTP_201_CREATED)

    def destroy(self, request, pk=None):
        services.delete_suggestion(self.get_object(), request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def vote(self, request, pk=None):
        suggestion = self.get_object()
        s = VoteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        services.vote(suggestion, request.user, s.validated_data["kind"])
        return Response(self._detail(suggestion))

    @action(detail=True, methods=["delete"])
    def remove_vote(self, request, pk=None):
        suggestion = self.get_object()
        services.remove_vote(suggestion, request.user)
        return Response(self._detail(suggestion))

    @action(detail=True, methods=["post"])
    def decide(self, request, pk=None):
        suggestion = self.get_object()
        s = DecideSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        services.decide(suggestion, request.user, **s.validated_data)
        return Response(self._detail(suggestion))
