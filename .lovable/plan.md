
# Fix: push_tokens_role_check Constraint

## Kök Neden
`push_tokens` tablosundaki CHECK constraint `role IN ('teacher', 'student')` olarak tanımlı. Admin token kaydedilmeye çalışınca `push_tokens_role_check` ihlali oluşuyor.

## Düzeltme
Tek SQL migration:
```sql
ALTER TABLE public.push_tokens DROP CONSTRAINT push_tokens_role_check;
ALTER TABLE public.push_tokens ADD CONSTRAINT push_tokens_role_check CHECK (role IN ('teacher', 'student', 'admin'));
```

## Dosya
- 1 SQL migration dosyası

## Risk
Sıfır. Mevcut teacher/student kayıtlarına dokunulmuyor, sadece admin ekleniyor.
