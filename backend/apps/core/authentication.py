from rest_framework.authentication import SessionAuthentication


class SessionAuth(SessionAuthentication):
    """Kirilmagan so'rovga 403 emas, 401 qaytadi — frontend login sahifasiga yo'naltiradi.

    Alohida modulda: DRF sozlamalari yuklanayotganda `rest_framework.views` bilan aylanma import bo'lmasligi uchun.
    """

    def authenticate_header(self, request):
        return "Session"
