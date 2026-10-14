# 0005 — Loyiha yakunlash: dasturchilar → PM → boshqarma

- Holat: Qabul qilingan
- Sana: 2026-10-02 / 2026-10-05 / 2026-10-06
- Manba: `requirements-log.md` (shu sanalar); `docs/modules/projects.md`; `apps/projects/workflow.py`

## Kontekst
Loyiha faqat PM bosganda yakunlansa, ishni bajargan dasturchilar va buyurtma bergan boshqarma fikri hisobga olinmaydi.

## Qaror
1. PM/Boshliq yakunlashni so'raydi (izoh + fayl).
2. Loyihadagi faol dasturchilardan "Ha, roziman"/"Yo'q" so'raladi (bildirishnoma ichidagi tugma). Hamma rozi bo'lsa PMga xabar boradi, "Yakunlash" ochiladi — avtomatik yakunlanmaydi. Birortasi sabab bilan rad etsa — yakunlanmaydi.
3. Buyurtmasiz loyihani PM yakunlaydi; buyurtmali loyiha "Tasdiqlash kutilmoqda"ga o'tadi va faqat buyurtmani yuborgan boshqarma tasdiqlaydi yoki sabab bilan rad etadi.
4. Yakunlangan / tasdiq kutayotgan loyihada vazifa va ijrochi biriktirish serverda yopiq.
Qoida bitta joyda: `projects/workflow.py` (`pending_acks`, `completion_locked`), `projects/services.py`.

## Nima uchun
Ikki bosqichli tasdiq: ish bajaruvchilar va buyurtmachi roziligi. "Hamma rozimi?" qoidasi 4 joyda turlicha edi — bitta funksiyaga jamlandi.

## Oqibatlar
Jamoa o'zgarsa faol so'rov davri bekor qilinadi (yig'ilgan tasdiqlar jamoa o'zgarmasa saqlanadi). Yangi flow/modal ochilmadi — mavjud ProjectModal, OrderModal, bildirishnoma kengaytirildi.
