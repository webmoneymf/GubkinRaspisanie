(() => {
  "use strict";

  const cfg = window.GUBKIN_CONFIG;
  const $ = (id) => document.getElementById(id);
  const state = {
    groups: [],
    lessons: [],
    week: null,
    organizations: [],
    selectedGroup: String(cfg.defaultGroupId),
    selectedDay: 0,
    view: "week",
    updatedAt: null,
    timer: null,
    loading: false
  };

  const DAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
  const SHORT_DAYS = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];
  const CACHE_KEY = "gubkin-schedule-cache-v1";
  const GROUP_KEY = "gubkin-schedule-group-v1";

  function pathValue(obj, path) {
    return (path || "").split(".").filter(Boolean).reduce((v, k) => v == null ? undefined : v[k], obj);
  }

  function fillUrl(template, groupId) {
    return template
      .replaceAll("{{studyId}}", encodeURIComponent(cfg.studyId))
      .replaceAll("{{facultyId}}", encodeURIComponent(cfg.facultyId))
      .replaceAll("{{groupId}}", encodeURIComponent(groupId));
  }

  async function request(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), cfg.requestTimeoutMs || 15000);
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json" },
        credentials: "omit",
        signal: controller.signal,
        cache: "no-store"
      });
      if (!response.ok) throw new Error(`Сервер ответил HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  function requireEndpoint(name) {
    const value = cfg.endpoints[name];
    if (!value || !value.trim()) {
      throw new Error(`Не настроен URL API «${name}». Откройте config.js и вставьте точный адрес запроса из DevTools → Network → Fetch/XHR.`);
    }
    return value.trim();
  }

  function normalizeGroups(payload) {
    const candidate = pathValue(payload, cfg.responsePaths.groups) ?? payload?.data ?? payload;
    const list = Array.isArray(candidate) ? candidate :
      Array.isArray(candidate?.groups) ? candidate.groups :
      Array.isArray(candidate?.items) ? candidate.items : [];
    return list.map((g) => ({
      id: String(g.id ?? g.groupId ?? ""),
      code: String(g.code ?? g.name ?? g.title ?? g.number ?? ""),
      facultyId: g.facultyId == null ? null : Number(g.facultyId),
      raw: g
    })).filter(g => g.id && g.code && (g.facultyId == null || g.facultyId === Number(cfg.facultyId)));
  }

  function normalizeSchedule(payload) {
    const rows = pathValue(payload, cfg.responsePaths.schedule) ?? payload?.data ?? payload;
    if (!rows || typeof rows !== "object") throw new Error("Неизвестная структура ответа расписания.");
    const organizations = rows.organizations || [];
    const org = organizations.find(x => Number(x.id) === Number(cfg.organizationId));
    const rawLessons = org?.lessons || rows.lessons || rows.activities || [];
    const chunks = org?.lessonsTimeChunks || [];
    const lessons = rawLessons.map((lesson) => {
      const indexes = Array.isArray(lesson.timeChunks) ? lesson.timeChunks : [];
      const startIndex = indexes.length ? Math.min(...indexes) : -1;
      const endIndex = indexes.length ? Math.max(...indexes) : -1;
      const first = startIndex >= 0 ? chunks[startIndex] : "";
      const last = endIndex >= 0 ? chunks[endIndex] : "";
      const start = first.includes("-") ? first.split("-")[0] : "";
      const end = last.includes("-") ? last.split("-")[1] : "";
      const teachers = lesson.teachers || [];
      const rooms = lesson.rooms || [];
      const changes = lesson.changes || {};
      const changedTeachers = changes.teachers || [];
      const date = lesson.date || lesson.lessonDate || null;
      return {
        id: lesson.id,
        day: Number(lesson.weekDayNumber ?? 0),
        date,
        start, end,
        subject: lesson.course?.name || lesson.name || "Занятие",
        type: lesson.type || "",
        subgroup: Number(lesson.subgroup || 0),
        teacher: (changedTeachers.length ? changedTeachers : teachers)
          .map(t => [t.lastName, t.firstName, t.patronymic].filter(Boolean).join(" ")).filter(Boolean).join(", "),
        room: (lesson.rooms || []).map(r => r.number).filter(Boolean).join(", "),
        canceled: Boolean(lesson.isCanceled),
        moved: Boolean(lesson.isMoved),
        changed: Boolean(lesson.isMoved || Object.keys(changes).length),
        raw: lesson
      };
    });
    return { lessons, week: rows.week || null, organizations };
  }

  function showNotice(message, kind = "error") {
    const el = $("notice");
    el.textContent = message;
    el.className = `notice ${kind}`;
    el.hidden = !message;
  }

  function setConnection(message, ok = false) {
    $("connectionState").textContent = message;
    $("connectionState").className = ok ? "connected" : "disconnected";
  }

  function setUpdated(date) {
    state.updatedAt = date;
    $("updatedAt").textContent = date
      ? `Обновлено в ${new Intl.DateTimeFormat("ru-RU", {hour:"2-digit", minute:"2-digit"}).format(date)}`
      : "Обновление ещё не выполнялось";
  }

  function readCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (!cached) return false;
      state.lessons = cached.lessons || [];
      state.week = cached.week || null;
      state.organizations = cached.organizations || [];
      if (cached.updatedAt) setUpdated(new Date(cached.updatedAt));
      render();
      return true;
    } catch { return false; }
  }

  function saveCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        lessons: state.lessons, week: state.week,
        organizations: state.organizations,
        updatedAt: state.updatedAt?.toISOString() || null
      }));
    } catch { /* local storage may be disabled or full */ }
  }

  async function loadGroups() {
    const payload = await request(requireEndpoint("groups"));
    const groups = normalizeGroups(payload);
    if (!groups.length) throw new Error("API ответил, но список групп не распознан. Проверьте responsePaths.groups и структуру ответа.");
    state.groups = groups.sort((a,b) => a.code.localeCompare(b.code, "ru"));
    const saved = localStorage.getItem(GROUP_KEY);
    if (saved && groups.some(g => g.id === saved)) state.selectedGroup = saved;
    if (!groups.some(g => g.id === state.selectedGroup)) state.selectedGroup = groups[0].id;
    const select = $("groupSelect");
    select.innerHTML = "";
    groups.forEach(group => {
      const option = document.createElement("option");
      option.value = group.id;
      option.textContent = group.code;
      select.append(option);
    });
    select.value = state.selectedGroup;
    select.disabled = false;
  }

  async function loadSchedule({quiet = false} = {}) {
    if (state.loading) return;
    state.loading = true;
    $("refreshBtn").disabled = true;
    $("refreshBtn").classList.add("spinning");
    try {
      const url = fillUrl(requireEndpoint("schedule"), state.selectedGroup);
      const payload = await request(url);
      const normalized = normalizeSchedule(payload);
      state.lessons = normalized.lessons;
      state.week = normalized.week;
      state.organizations = normalized.organizations;
      setUpdated(new Date());
      saveCache();
      render();
      showNotice("", "success");
      setConnection("Соединение с сервером активно", true);
    } catch (error) {
      const hasCache = state.lessons.length > 0;
      showNotice(`${error.message}${hasCache ? " Показана последняя сохранённая версия расписания." : ""}`);
      setConnection("Нет актуального соединения", false);
      if (!quiet && !hasCache) renderEmpty(error.message);
    } finally {
      state.loading = false;
      $("refreshBtn").disabled = false;
      $("refreshBtn").classList.remove("spinning");
    }
  }

  function parseDate(value) {
    if (!value) return null;
    const m = String(value).match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (m) return new Date(+m[3], +m[2]-1, +m[1]);
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function dateForDay(day) {
    const days = state.week?.weekRussia?.days || state.week?.days || [];
    const found = days.find(d => Number(d.weekDayNumber) === Number(day));
    return found ? parseDate(found.date) : null;
  }

  function formatDate(d) {
    return d ? new Intl.DateTimeFormat("ru-RU", {day:"numeric", month:"long"}).format(d) : "";
  }

  function renderTabs() {
    const tabs = $("dayTabs");
    tabs.innerHTML = "";
    DAYS.forEach((name, i) => {
      const date = dateForDay(i);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `day-tab ${state.selectedDay === i ? "active" : ""}`;
      btn.innerHTML = `<span>${SHORT_DAYS[i]}</span><small>${date ? date.getDate() : "—"}</small>`;
      btn.setAttribute("aria-label", `${name}${date ? ", " + formatDate(date) : ""}`);
      btn.addEventListener("click", () => { state.selectedDay = i; render(); });
      tabs.append(btn);
    });
  }

  function lessonCard(lesson) {
    const card = document.createElement("article");
    card.className = `lesson-card ${lesson.canceled ? "canceled" : ""} ${lesson.changed ? "changed" : ""}`;
    const time = lesson.start && lesson.end ? `${lesson.start} — ${lesson.end}` : "Время не указано";
    const badge = lesson.canceled ? "Отменено" : lesson.moved ? "Перенесено" : lesson.changed ? "Изменено" : lesson.type;
    card.innerHTML = `
      <div class="lesson-time">${escapeHtml(time)}</div>
      <div class="lesson-main">
        <div class="lesson-meta">${badge ? `<span class="lesson-type">${escapeHtml(badge)}</span>` : ""}${lesson.subgroup ? `<span class="subgroup">Подгруппа ${lesson.subgroup}</span>` : ""}</div>
        <h3>${escapeHtml(lesson.subject)}</h3>
        <div class="lesson-details">
          ${lesson.teacher ? `<span>♙ ${escapeHtml(lesson.teacher)}</span>` : ""}
          ${lesson.room ? `<span>⌖ ${escapeHtml(lesson.room)}</span>` : ""}
        </div>
      </div>`;
    return card;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }

  function renderEmpty(message) {
    $("schedule").innerHTML = `<div class="empty-state"><b>Не удалось загрузить расписание</b><small>${escapeHtml(message)}</small></div>`;
  }

  function render() {
    renderTabs();
    const days = state.week?.weekRussia?.days || state.week?.days || [];
    const current = days.find(d => Number(d.weekDayNumber) === state.selectedDay);
    $("weekTitle").textContent = current?.date
      ? `${DAYS[state.selectedDay]}, ${formatDate(parseDate(current.date))}`
      : "Расписание занятий";
    const lessons = state.lessons.filter(l => Number(l.day) === state.selectedDay)
      .sort((a,b) => (a.start || "").localeCompare(b.start || ""));
    const container = $("schedule");
    container.innerHTML = "";
    const visibleDays = state.view === "day" ? [state.selectedDay] : DAYS.map((_,i) => i);
    if (state.view === "week") container.classList.add("week-view"); else container.classList.remove("week-view");
    visibleDays.forEach(day => {
      const dayLessons = state.lessons.filter(l => Number(l.day) === day)
        .sort((a,b) => (a.start || "").localeCompare(b.start || ""));
      const column = document.createElement("section");
      column.className = "day-column";
      const date = dateForDay(day);
      column.innerHTML = `<div class="day-column-head"><b>${DAYS[day]}</b><span>${date ? formatDate(date) : ""}</span></div>`;
      if (!dayLessons.length) {
        const empty = document.createElement("div");
        empty.className = "day-empty";
        empty.textContent = "Занятий нет";
        column.append(empty);
      } else dayLessons.forEach(lesson => column.append(lessonCard(lesson)));
      container.append(column);
    });
    if (!state.lessons.length) {
      container.innerHTML = `<div class="empty-state"><b>На выбранную неделю занятий не найдено</b><small>Если API вернул пустой список, это может быть актуальное состояние расписания.</small></div>`;
    }
  }

  function startAutoRefresh() {
    clearInterval(state.timer);
    state.timer = setInterval(() => loadSchedule({quiet:true}), Math.max(60000, Number(cfg.refreshIntervalMs) || 120000));
  }

  $("groupSelect").addEventListener("change", async (event) => {
    state.selectedGroup = event.target.value;
    localStorage.setItem(GROUP_KEY, state.selectedGroup);
    state.lessons = [];
    await loadSchedule();
  });
  $("refreshBtn").addEventListener("click", () => loadSchedule());
  document.querySelectorAll(".view-btn").forEach(btn => btn.addEventListener("click", () => {
    state.view = btn.dataset.view;
    document.querySelectorAll(".view-btn").forEach(b => b.classList.toggle("active", b === btn));
    render();
  }));

  async function init() {
    const hadCache = readCache();
    try {
      await loadGroups();
      await loadSchedule({quiet:true});
      startAutoRefresh();
    } catch (error) {
      showNotice(error.message + (hadCache ? " Показана сохранённая копия расписания." : ""));
      setConnection("Требуется настройка API", false);
      $("groupSelect").disabled = true;
      if (!hadCache) renderEmpty(error.message);
    }
  }
  init();
})();