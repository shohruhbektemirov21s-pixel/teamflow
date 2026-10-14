"""Rasm sifati qoidasi (`core/images.py`): tiniq saqlash, kichik rasm kattalashtirilmaydi."""
import io

from django.test import SimpleTestCase
from PIL import Image, JpegImagePlugin

from apps.core.images import JPEG_QUALITY, to_sharp_jpeg


def decode(data):
    return Image.open(io.BytesIO(data))


def checkerboard(size, step=4):
    image = Image.new("RGB", size, "white")
    pixels = image.load()
    for x in range(size[0]):
        for y in range(size[1]):
            if (x // step + y // step) % 2:
                pixels[x, y] = (220, 20, 20)
    return image


class SharpJpegTests(SimpleTestCase):
    def test_keeps_full_colour_resolution_and_high_quality(self):
        image = decode(to_sharp_jpeg(checkerboard((400, 300)), 1280))
        self.assertEqual(image.format, "JPEG")
        self.assertEqual(JpegImagePlugin.get_sampling(image), 0)  # 4:4:4 — rangli chekkalar xiralashmaydi
        self.assertGreaterEqual(JPEG_QUALITY, 90)
        # Qizil/oq chegarada rang deyarli o'zgarmaydi (4:2:0 da bu yerda rang suriladi)
        red = image.getpixel((6, 2))
        self.assertGreater(red[0], 200)
        self.assertLess(red[1], 60)

    def test_small_image_is_never_upscaled_and_large_is_reduced(self):
        self.assertEqual(decode(to_sharp_jpeg(Image.new("RGB", (300, 200), "blue"), 1280)).size, (300, 200))
        big = decode(to_sharp_jpeg(Image.new("RGB", (3000, 2000), "blue"), 1280))
        self.assertEqual(max(big.size), 1280)
        self.assertEqual(big.size, (1280, 853))

    def test_transparency_becomes_white_not_black(self):
        data = to_sharp_jpeg(Image.new("RGBA", (50, 50), (0, 0, 0, 0)), 1280)
        pixel = decode(data).getpixel((25, 25))
        self.assertTrue(all(channel > 245 for channel in pixel), pixel)

    def test_palette_and_grayscale_images_are_converted(self):
        for mode in ("P", "L", "CMYK"):
            image = Image.new("RGB", (40, 40), "green").convert(mode)
            self.assertEqual(decode(to_sharp_jpeg(image, 1280)).mode, "RGB", mode)
