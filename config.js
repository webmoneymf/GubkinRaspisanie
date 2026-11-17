/*
 * ВАЖНО: в приложенном info.docx сохранены JSON-ответы, но не URL запросов
 * и не HTTP-параметры из DevTools. Поэтому endpoint-ы намеренно оставлены
 * пустыми — адреса API нельзя достоверно восстановить по телу ответа.
 *
 * После экспорта реальных запросов Network → Fetch/XHR вставьте сюда
 * их URL-шаблоны без Cookie/Authorization/токенов.
 *
 * Поддерживаемые подстановки в URL:
 *   {{studyId}}, {{facultyId}}, {{groupId}}
 *
 * Не добавляйте секреты. Если API требует авторизацию, используйте серверный
 * прокси с безопасным хранением секретов, а не публикуйте их в GitHub Pages.
 */
window.GUBKIN_CONFIG = {
  studyId: 63,
  facultyId: 15,
  organizationId: 1, // В JSON ответа организация id=1 имеет name="Оренбург".
  defaultGroupId: 10568,
  refreshIntervalMs: 120000,
  requestTimeoutMs: 15000,

  // Вставьте точные URL из DevTools. Никакие пути не предполагаются.
  endpoints: {
    groups: "",
    schedule: ""
  },

  // Если сервер возвращает массив не в корне, можно указать путь через точку.
  // Примеры: "rows", "data.items". Оставлено по умолчанию для типичных ответов.
  responsePaths: {
    groups: "rows",
    schedule: "rows"
  }
};