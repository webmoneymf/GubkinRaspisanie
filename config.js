window.GUBKIN_CONFIG = {
  studyId: 63,
  facultyId: 15,
  organizationId: 1,
  defaultGroupId: 10568,
  refreshIntervalMs: 120000,
  requestTimeoutMs: 15000,
  endpoints: {
    groups: "https://gubkin-schedule-proxy.markderden17.workers.dev/?act=list",
    schedule: "https://gubkin-schedule-proxy.markderden17.workers.dev/?act=schedule&date={{date}}&groupId={{groupId}}"
  }
};

