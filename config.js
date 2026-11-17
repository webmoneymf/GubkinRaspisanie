window.GUBKIN_CONFIG = {
  studyId: 63,
  facultyId: 15,
  organizationId: 1,
  defaultGroupId: 10568,
  refreshIntervalMs: 120000,
  requestTimeoutMs: 15000,
  endpoints: {
    groups: "https://lk.gubkin.ru/schedule/api/api.php?act=list&method=getFacultyGroups&facultyId=15",
    schedule: "https://lk.gubkin.ru/schedule/api/api.php?act=schedule&date={{date}}&groupId={{groupId}}"
  },
  responsePaths: {
    groups: "rows",
    schedule: "rows"
  }
};
