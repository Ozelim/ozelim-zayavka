# ozelim-zayavka

Кабинет модераторов для обработки заявок (leads), общая БД с `ozelim2`/`ozelim-admin2`.

- Аутентификация: `users.role = 'moderator'`, `is_active = true`, cookie `moderator_session`.
- Доступ к типам заявок — таблица `moderator_lead_kinds (user_id, kind)`.
- Управление модераторами и их доступами — в `ozelim-admin2` (`/moderators`).
- Только одна страница: список заявок + смена статуса + комментарии.
