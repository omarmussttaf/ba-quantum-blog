# BA Search v0.2 — تفعيل البحث متعدد المصادر

تم تجهيز المشروع ليبحث في ثلاثة مصادر علمية في الطلب الواحد:

- OpenAlex
- Crossref
- Europe PMC

ويقوم Supabase Edge Function بـ:
1. جلب حتى 30 نتيجة من كل مصدر.
2. توحيد الحقول.
3. إزالة التكرار باستخدام DOI، ثم بصمة العنوان عند غياب DOI.
4. حساب BA Score.
5. إعادة أفضل 60 نتيجة إلى الواجهة.

## معادلة BA Score الحالية

- 45% صلة البحث
- 20% الاستشهادات (باستخدام log normalization داخل مجموعة النتائج الحالية)
- 15% الحداثة
- 5% Open Access
- 5% اكتمال metadata
- 10% توافق المصادر (ظهور الورقة في أكثر من مصدر)

مهم: BA Score ليس تقييمًا للجودة العلمية للورقة. هو ترتيب بحث.

## التفعيل

من داخل مجلد المشروع الذي يحتوي مجلد `supabase`:

```bash
supabase login
supabase link --project-ref grrrhfcnogtkbhivryki
supabase functions deploy research-search
```

لا نحتاج إلى وضع أي مفتاح سري للمصادر الثلاثة الحالية.

بعد النشر افتح `research.html` عبر Live Server وابحث عن موضوع.

إذا لم تكن Edge Function منشورة بعد، الواجهة ستعود تلقائيًا إلى OpenAlex فقط ولن تتوقف صفحة البحث.

## الاختبار المقترح

جرّب:
- quantum error correction
- CRISPR gene editing
- Alzheimer's disease biomarkers

وتأكد من ظهور:
- BA Top 1 / 2 / 3
- BA Score
- badges للمصادر
- خيارات BA Top / Most Relevant / Most Cited / Newest / Open Access
