# Modul: ai

**Vazifasi:** TinyFish AI web-agent: PM/Boshliq URL avtomatizatsiyasi yoki URLsiz web-tadqiqotni asinxron boshlaydi, holat/natijani so'raydi. Yangi UI flow/modal yo'q.

**Fayllar:** `models.py` (`WebAgentRun`), `api.py` (`WebAgentView`, yupqa), `services/web_agent.py` (`start_web_agent`, `refresh_run`), `services/tinyfish_service.py` (tashqi provayder klienti), `serializers.py`.

## API
`ai/web-agent/` (POST), `ai/web-agent/<id>/` (GET) — `IsAuthenticated + IsManager`, throttle `ai_web_agent` (5/soat) — `../api.md`.

## Xavfsizlik qoidalari
- API kalit faqat `backend/.env` dagi `TINYFISH_API_KEY` — **qiymati hech qayerga yozilmaydi**.
- Private/internal URL'lar serverda bloklanadi (SSRF himoyasi).
- Polling retry qilinadi; asinxron start ikki marta xarajat bo'lmasligi uchun retry qilinmaydi.
- Biznes mantiq `api.py` da emas, `services/web_agent.py` da.

## Bog'liqlik
Faqat `core`.

## Testlar
`apps/ai/tests/`: `test_api`, `test_tinyfish_service`.
