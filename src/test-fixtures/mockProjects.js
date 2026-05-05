/* Mock projects for the timeline test page (?test=timeline).
   Designed to expose the label-jitter bug:
   - mix of short / long / overlapping spans
   - some projects extend FAR beyond the initial visible window so labels
     have to recenter as the user pans
   - subs include both done_at and deadline variants for dot rendering */

const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const dk = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addD = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

export function createMockProjects() {
  const t = today();
  return [
    {
      id: "mock-1",
      text: "디자인 시스템 정비 (긴 스팬, 라벨 중앙 추적용)",
      done: false,
      pal: "slate",
      start: dk(addD(t, -45)),
      end: dk(addD(t, 60)),
      sort_order: 0,
      subs: [
        { sid: "s1", text: "컬러 팔레트 정리", done: true, done_at: dk(addD(t, -30)), deadline: dk(addD(t, -25)) },
        { sid: "s2", text: "타이포그래피 가이드", done: true, done_at: dk(addD(t, -10)), deadline: dk(addD(t, -5)) },
        { sid: "s3", text: "컴포넌트 라이브러리", done: false, done_at: null, deadline: dk(addD(t, 20)) },
        { sid: "s4", text: "배포 체크리스트", done: false, done_at: null, deadline: dk(addD(t, 50)) },
      ],
    },
    {
      id: "mock-2",
      text: "API v2 마이그레이션",
      done: false,
      pal: "red",
      start: dk(addD(t, -90)),
      end: dk(addD(t, 30)),
      sort_order: 1,
      subs: [
        { sid: "s5", text: "인증 모듈", done: true, done_at: dk(addD(t, -70)), deadline: dk(addD(t, -65)) },
        { sid: "s6", text: "결제 연동", done: false, done_at: null, deadline: dk(addD(t, 14)) },
      ],
    },
    {
      id: "mock-3",
      text: "신규 온보딩 흐름",
      done: false,
      pal: "green",
      start: dk(addD(t, -10)),
      end: dk(addD(t, 90)),
      sort_order: 2,
      subs: [
        { sid: "s7", text: "환영 모달", done: false, done_at: null, deadline: dk(addD(t, 5)) },
        { sid: "s8", text: "튜토리얼 비디오", done: false, done_at: null, deadline: null },
      ],
    },
    {
      id: "mock-4",
      text: "여름 이벤트 페이지 (미래 시작)",
      done: false,
      pal: "sky",
      start: dk(addD(t, 30)),
      end: dk(addD(t, 75)),
      sort_order: 3,
      subs: [],
    },
    {
      id: "mock-5",
      text: "레거시 대시보드 정리 (완료된 항목)",
      done: true,
      pal: "purple",
      start: dk(addD(t, -120)),
      end: dk(addD(t, -60)),
      sort_order: 4,
      subs: [
        { sid: "s9", text: "리포트 통합", done: true, done_at: dk(addD(t, -75)), deadline: dk(addD(t, -80)) },
      ],
    },
    {
      id: "mock-6",
      text: "짧은 스프린트",
      done: false,
      pal: "peach",
      start: dk(addD(t, -3)),
      end: dk(addD(t, 4)),
      sort_order: 5,
      subs: [
        { sid: "s10", text: "QA", done: false, done_at: null, deadline: dk(addD(t, 3)) },
      ],
    },
    {
      id: "mock-7",
      text: "장기 리서치",
      done: false,
      pal: "magenta",
      start: dk(addD(t, -150)),
      end: dk(addD(t, 150)),
      sort_order: 6,
      subs: [],
    },
  ];
}
