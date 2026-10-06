from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, override_settings

from apps.core.files import UploadTo, validate_upload


def upload(name, size):
    return SimpleUploadedFile(name, b"x" * size)


@override_settings(UPLOAD_ALLOWED_EXTENSIONS=["docx", "pdf", "png"], UPLOAD_MAX_MB=1)
class ValidateUploadTests(SimpleTestCase):
    def test_allowed_extension_is_case_insensitive(self):
        validate_upload(upload("TZ.DOCX", 10))

    def test_disallowed_extension_is_rejected(self):
        for name in ("virus.exe", "page.html", "noext"):
            with self.subTest(name=name), self.assertRaisesMessage(ValidationError, "qabul qilinmaydi"):
                validate_upload(upload(name, 10))

    def test_double_extension_uses_last_one(self):
        with self.assertRaises(ValidationError):
            validate_upload(upload("report.pdf.exe", 10))

    def test_exact_limit_passes_and_one_byte_over_fails(self):
        validate_upload(upload("a.pdf", 1024 * 1024))
        with self.assertRaisesMessage(ValidationError, "1 MB"):
            validate_upload(upload("a.pdf", 1024 * 1024 + 1))


class UploadToTests(SimpleTestCase):
    def test_random_name_keeps_folder_and_lowercase_extension(self):
        path = UploadTo("tasks")(None, "Mening Faylim.PDF")
        folder, name = path.split("/")
        self.assertEqual(folder, "tasks")
        self.assertTrue(name.endswith(".pdf"))
        self.assertNotIn("Faylim", name)

    def test_each_call_gives_a_new_name(self):
        upload_to = UploadTo("orders")
        self.assertNotEqual(upload_to(None, "a.docx"), upload_to(None, "a.docx"))
