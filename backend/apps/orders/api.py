from django.db.models import Q
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.core.api_utils import IsDepartment, require_manager

from . import services
from .filters import filter_orders
from .permissions import visible_orders
from .serializers import (
    ApproveSerializer,
    DatesSerializer,
    OrderCreateSerializer,
    OrderDetailSerializer,
    OrderListSerializer,
    OrderVersionCreateSerializer,
    RejectSerializer,
)


class OrderViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    """Buyurtmalar. O'chirish va tahrirlash yo'q (boshqarma yuborgach o'zgartira olmaydi)."""

    def get_queryset(self):
        qs = visible_orders(self.request.user).select_related("project").prefetch_related("versions")
        if self.action == "retrieve":
            qs = qs.prefetch_related("versions__decided_by")
        params = self.request.query_params
        qs = filter_orders(qs, params)
        if params.get("status"):
            qs = qs.filter(status__in=params["status"].split(","))
        if params.get("q"):
            q = params["q"]
            qs = qs.filter(Q(title__icontains=q) | Q(submitted_by__department_name__icontains=q))
        return qs

    def get_serializer_class(self):
        return OrderDetailSerializer if self.action == "retrieve" else OrderListSerializer

    def get_permissions(self):
        if self.action == "create":
            return [*super().get_permissions(), IsDepartment()]
        return super().get_permissions()

    def create(self, request):
        s = OrderCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        order = services.create_order(request.user, **s.validated_data)
        return Response(self._detail(order), status=status.HTTP_201_CREATED)

    def _detail(self, order):
        order = self.get_queryset().select_related("project").prefetch_related("versions__decided_by").get(pk=order.pk)
        return OrderDetailSerializer(order, context={"request": self.request}).data

    @action(detail=True, methods=["post"])
    def versions(self, request, pk=None):
        order = self.get_object()
        if order.submitted_by_id != request.user.pk:
            raise PermissionDenied("Faqat buyurtmani yuborgan boshqarma yangi versiya yubora oladi.")
        s = OrderVersionCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        services.add_version(order, request.user, **s.validated_data)
        return Response(self._detail(order), status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        require_manager(request.user)
        order = self.get_object()
        s = ApproveSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        services.approve_order(order, request.user, **s.validated_data)
        return Response(self._detail(order))

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        require_manager(request.user)
        order = self.get_object()
        s = RejectSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        services.reject_order(order, request.user, **s.validated_data)
        return Response(self._detail(order))

    @action(detail=True, methods=["post"])
    def dates(self, request, pk=None):
        require_manager(request.user)
        order = self.get_object()
        s = DatesSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        services.update_order_dates(order, request.user, **s.validated_data)
        return Response(self._detail(order))
