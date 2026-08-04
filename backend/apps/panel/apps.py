from django.apps import AppConfig


class PanelConfig(AppConfig):
    """Yig'uvchi qatlam (modelsiz): bir nechta modul ma'lumotini birlashtiradigan API.

    Bog'liqlik grafining eng tepasida turadi — hamma modulni import qila oladi, uni hech kim import qilmaydi.
    """

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.panel"
