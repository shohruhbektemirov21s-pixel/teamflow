import asyncio
from django.core.management.base import BaseCommand
from django.conf import settings
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes
from apps.accounts.models import CustomUser
from asgiref.sync import sync_to_async

class Command(BaseCommand):
    help = "Run Telegram bot"

    def handle(self, *args, **options):
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        loop.run_until_complete(self.run_bot())

    async def run_bot(self):
        token = getattr(settings, "TELEGRAM_BOT_TOKEN", None)
        if not token or token == "dummy_token_for_testing":
            self.stdout.write(self.style.ERROR("Haqiqiy TELEGRAM_BOT_TOKEN settings.py ga kiritilmagan."))
            return
        
        app = Application.builder().token(token).build()
        app.add_handler(CommandHandler("start", self.start_command))
        
        self.stdout.write(self.style.SUCCESS("Telegram Bot ishga tushdi..."))
        await app.initialize()
        await app.start()
        await app.updater.start_polling()
        
        try:
            while True:
                await asyncio.sleep(3600)
        except asyncio.CancelledError:
            pass
        finally:
            await app.updater.stop()
            await app.stop()
            await app.shutdown()

    async def start_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        username = update.effective_user.username
        if not username:
            await update.message.reply_text("Sizning Telegram profilingizda username yo'q. Iltimos, username o'rnating.")
            return

        @sync_to_async
        def get_user():
            u = username.replace("@", "")
            return CustomUser.objects.filter(telegram_username__iexact=u).first()

        user = await get_user()
        if user:
            await update.message.reply_text(f"Xush kelibsiz, {user.full_name}! Siz TeamFlow tizimida tasdiqlangansiz.")
        else:
            await update.message.reply_text("Siz tizimdan ro'yxatdan o'tmagansiz yoki telegram_username xato kiritilgan.")
