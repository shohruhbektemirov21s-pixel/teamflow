from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .realtime import user_group


class EventsConsumer(AsyncJsonWebsocketConsumer):
    """`/ws/events/` — kirgan foydalanuvchiga o'z hodisalari (`realtime.publish`). Mijozdan xabar qabul qilinmaydi."""

    async def connect(self):
        user = self.scope.get("user")
        if user is None or not user.is_authenticated or not user.is_active:
            await self.close(code=4401)
            return
        self.group = user_group(user.pk)
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        if getattr(self, "group", None):
            await self.channel_layer.group_discard(self.group, self.channel_name)

    async def receive_json(self, content, **kwargs):
        pass  # bir tomonlama kanal

    async def event(self, message):
        await self.send_json(message["payload"])
