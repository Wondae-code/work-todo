# 업무 할일 (Work Todo)

개인 업무 관리 웹앱. 프로젝트 업무와 빠른 업무를 구분하고, 서브 체크리스트와 날짜별 뷰를 지원합니다.

## 기술 스택

| 항목 | 기술 |
|------|------|
| 프레임워크 | Vite + React 19 |
| DB / 인증 | Supabase (PostgreSQL + Auth) |
| 배포 | Vercel |
| 폰트 | Pretendard Variable |

## 주요 기능

- 프로젝트 업무 / 빠른 업무 구분
- 프로젝트 업무: 자유 서브 체크리스트 (n차 컨펌 대응)
- 우선순위 1/2/3 배지 (클릭으로 순환 변경)
- 날짜별 뷰 + 달력 모달로 날짜 이동
- 타입 필터 + 우선순위 정렬
- 모바일 반응형
- Supabase RLS로 유저별 데이터 격리
- Magic Link 로그인 (비밀번호 불필요)

---

## 세팅 가이드

### 1. Supabase 프로젝트 생성

1. [supabase.com](https://supabase.com) 에서 무료 계정 생성
2. **New Project** → 이름/비밀번호 설정 → 리전은 `Northeast Asia (Tokyo)` 추천
3. 프로젝트 생성 완료 후 **SQL Editor** 이동
4. `supabase/schema.sql` 내용 전체 복사 → 실행 (Run)
5. **Settings → API** 에서 아래 두 값 복사:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon / public` 키 → `VITE_SUPABASE_ANON_KEY`

### 2. 인증 설정

1. Supabase Dashboard → **Authentication → Providers**
2. **Email** 활성화 (기본 활성화됨)
3. Magic Link를 쓸 경우: **Enable Email OTP** 활성화
4. **URL Configuration** → Site URL을 배포 URL로 설정
   - 로컬 개발: `http://localhost:3000`
   - Vercel 배포 후: `https://your-app.vercel.app`

### 3. 로컬 개발

```bash
# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env
# .env 파일을 열어 Supabase URL과 Key 입력

# 개발 서버 실행
npm run dev
```

`http://localhost:3000` 에서 확인.

### 4. Vercel 배포

1. GitHub에 이 레포를 push
2. [vercel.com](https://vercel.com) → **Import Project** → GitHub 레포 선택
3. **Environment Variables** 에 아래 추가:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. **Deploy** 클릭
5. 배포 완료 후 Supabase의 **Site URL**을 Vercel 도메인으로 업데이트

이후 GitHub push 시 자동 배포됨.

### 5. 커스텀 도메인 (선택)

Vercel 무료 서브도메인(`your-app.vercel.app`)으로도 충분하지만, 원하면:
1. [Cloudflare Registrar](https://dash.cloudflare.com) 에서 `.dev` 또는 `.app` 도메인 구매 (~$10/년)
2. Vercel → **Settings → Domains** → 도메인 추가
3. Cloudflare DNS에 Vercel CNAME 레코드 추가

---

## 프로젝트 구조

```
work-todo/
├── index.html                  # HTML 진입점
├── package.json
├── vite.config.js
├── .env.example                # 환경변수 템플릿
├── supabase/
│   └── schema.sql              # DB 스키마 + RLS 정책
└── src/
    ├── main.jsx                # React 마운트
    ├── App.jsx                 # 인증 라우팅
    ├── app.css                 # 글로벌 CSS + 변수
    ├── lib/
    │   └── supabase.js         # Supabase 클라이언트
    ├── hooks/
    │   ├── useAuth.js          # 인증 훅
    │   └── useTasks.js         # 할일 CRUD 훅 (Supabase 연동)
    └── components/
        ├── Auth.jsx            # 로그인/회원가입 페이지
        ├── WorkTodo.jsx        # 메인 할일 관리 UI
        └── CalendarModal.jsx   # 달력 날짜 선택 모달
```

## 데이터 모델

### tasks
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | bigint (PK) | 자동 증가 |
| user_id | uuid (FK) | auth.users 참조 |
| text | text | 할일 내용 |
| done | boolean | 완료 여부 |
| priority | smallint | 1(긴급), 2(보통), 3(낮음) |
| type | text | 'project' 또는 'quick' |
| date_key | text | 'YYYY-MM-DD' |

### subtasks
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | bigint (PK) | 자동 증가 |
| task_id | bigint (FK) | tasks.id 참조 |
| text | text | 서브항목 내용 |
| done | boolean | 완료 여부 |
| sort_order | smallint | 정렬 순서 |

---

## 향후 확장 가능

- 반복 루틴 템플릿
- 주간 달성률 통계
- 드래그 앤 드롭 순서 변경
- 다크 모드
- PWA (오프라인 + 홈 화면 추가)
