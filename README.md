# Pomogator · новости

Утверждённые владельцем записи в `news/ГГГГ/ГГГГ-ММ-ДД-slug.md`.
У каждой записи один блок YAML с обязательными пересказами es, ru и en.
Тело Markdown и иллюстрации отсутствуют. Поля и теги заданы в
`schema/news.schema.json`. Пустой каталог соответствует пустой ленте.

`npm ci --ignore-scripts` и `npm run validate` проверяют записи
на Node.js 24.22.3. GitHub Actions при изменениях в `main` проверяет
данные и вызывает Vercel deploy hook только после успешной проверки.
Секрет `VERCEL_DEPLOY_HOOK` добавляется при S3. Схема и скрипт
проверки совпадают с проверкой `pomogator-site`.
