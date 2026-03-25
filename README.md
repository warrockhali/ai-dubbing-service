# 🎤 AI 더빙 웹 서비스 (ESTsoft 인턴 과제)

## 📌 서비스 소개 및 주요 기능
Next.js(App Router) 기반으로 구축된 다국어 AI 더빙 웹 서비스입니다. 
사용자의 미디어 파일(오디오 및 비디오)을 업로드받아 **음성 추출 → 전사(STT) → 번역 → 음성 합성(TTS) → 비디오 병합(Muxing)** 단계로 이뤄진 파이프라인을 제공합니다.

- **미디어 더빙 파이프라인**: 단순 오디오뿐만 아니라 MP4 영상 파일 업로드 시, 원본 영상 트랙에 다국어 타겟의 새로운 더빙 오디오를 입혀 즉시 합성된 영상(Video)을 결과물로 제공합니다.
- **보안 화이트리스트 접근 제어**: 지정된 허용 이메일(kts123@estsoft.com 등)만 서비스 대시보드에 접근할 수 있도록 Turso DB와 연동된 NextAuth 보안 미들웨어가 적용되어 있습니다.

## 🛠 사용한 기술 스택
- **프레임워크**: Next.js 15 (App Router), TypeScript
- **데이터베이스/ORM**: Turso DB, Drizzle ORM
- **보안/인증**: NextAuth.js (Google OAuth API)
- **AI 파이프라인**: ElevenLabs SDK (`@elevenlabs/elevenlabs-js`), Google Translate API
- **전처리/후처리**: ffmpeg (`fluent-ffmpeg`, `@ffmpeg-installer/ffmpeg`)
- **스타일링**: Vanilla CSS 변수와 Glassmorphism 기반의 모던 UI 체계

## 🔗 배포된 서비스 URL
**👉 [https://ai-dubbing-service.vercel.app/](https://ai-dubbing-service.vercel.app/)**

## 🚀 로컬 실행 방법
1. 저장소 클론 및 패키지 설치
   ```bash
   git clone git@github.com:warrockhali/ai-dubbing-service.git
   cd ai-dubbing-service
   npm install
   ```
2. 환경 변수(`.env.local`) 구성
   ```env
   # Authentication
   GOOGLE_CLIENT_ID="구글 OAuth 클라이언트 ID"
   GOOGLE_CLIENT_SECRET="구글 OAuth 시크릿"
   NEXTAUTH_SECRET="랜덤 생성 시크릿 문자열"
   NEXTAUTH_URL="http://localhost:3000"

   # Database (Turso)
   TURSO_DATABASE_URL="libsql://your-turso-db-url"
   TURSO_AUTH_TOKEN="your-turso-auth-token"

   # AI Pipeline
   ELEVENLABS_API_KEY="your-elevenlabs-api-key"
   ```
3. 데이터베이스 마이그레이션 및 초기 데이터 설정(Seed)
   ```bash
   npx drizzle-kit push
   npx tsx src/lib/db/seed.ts
   ```
4. 로컬 서버 실행
   ```bash
   npm run dev
   ```

## 🤖 코딩 에이전트 활용 방법 및 노하우

과제 수행 간 AI 코딩 에이전트를 효과적으로 통제하고 활용하기 위해 적용했던 **사용자 주도적 방법론과 핵심 노하우**입니다.

### 1. 명확한 규칙(Rule) 선언을 통한 자율성 제어
에이전트에게 무작정 코딩을 맡기기 전에, 커밋 컨벤션(한글 요약, 기능 단위 명시), 구현 시 준수해야 할 필수 요구사항(Next.js App Router, Turso DB 필수 도입 등), 그리고 에이전트의 답변 스타일(무조건적 칭찬 자제 및 객관적 엣지 케이스 피드백 제공)을 `.md` 텍스트 형태의 Rule로 명확히 주입했습니다. 이를 통해 에이전트가 궤도를 이탈하지 않고 일관된 퀄리티의 산출물을 낼 수 있게 가이드했습니다.

### 2. 보안 취약점 사전 차단 및 민감 정보 통제
AI 에이전트가 `.env` 환경 변수 파일이나 과제 지시서 PDF 등 보안상 민감한 데이터를 함부로 GitHub 원격 저장소에 올리거나 유출하지 못하도록 엄격히 통제했습니다. 작업 초기 단계부터 `.gitignore`를 확실히 점검하게 만들었고, 보안에 구멍이 생길 수 있는 설정(ex. DB 접속 권한 오픈)은 개발자의 승인 없이 함부로 덮어씌울 수 없도록 제어하여 웹 서비스의 근본적인 취약점 발생을 막았습니다.

### 3. "계획 먼저, 실행은 나중에" (Step-by-Step 접근법)
거대한 파이프라인(로그인 → STT → 번역 → TTS → 영상 병합)을 한 번의 프롬프트로 다 짜라고 지시하면 에이전트가 환각(Hallucination)을 일으키거나 전체 구조를 망칠 확률이 매우 높습니다. 따라서 사전에 에이전트에게 **"무엇을 할지 구체적인 계획서(Implementation Plan)와 체크리스트를 먼저 작성하라"**고 지시했습니다. 작성된 파이프라인 설계도를 검토하여 승인한 이후에야 프론트엔드 UI 구축, DB 스키마 생성, ElevenLabs API 연동 등의 작은 단위(Task)들을 하나씩 순차적으로 완성시켜 나가는 구조적인 방식을 택했습니다.

### 4. 에이전트 결과물에 대한 비판적 검토 및 주도권 획득 (Cross-Check)
AI 에이전트는 종종 환각(Hallucination)을 겪거나 구버전의 라이브러리 명세를 무비판적으로 사용하는 실수를 범합니다. (실제로 ElevenLabs 최신 SDK의 `camelCase`를 구버전의 `snake_case`로 착각하여 오류가 발생한 사례가 있었습니다.) 따라서 에이전트가 작성한 방대한 코드라도 무조건 신뢰하기보다는, 개발자 본인이 핵심 비즈니스 로직과 변수 흐름을 공식 문서와 교차 검증(Cross-Check)하는 습관을 들였습니다. 리뷰어로서 주도권을 쥐었을 때 가장 완성도 높은 프로덕트가 나옵니다.

### 5. 명확한 에러 로그 제공을 통한 컨텍스트(Context) 제한 기법
오류가 발생했을 때 단순히 "에러가 났어, 고쳐줘"라고 두루뭉술하게 지시하면, 에이전트는 방대한 프로젝트 전체를 훑으며 애먼 정상 코드를 파괴할 우려가 있습니다. Vercel 배포 후 500 에러가 났을 때나 빌드가 실패했을 때, 터미널의 정확한 **에러 스택 트레이스(Stack Trace)** 나 **런타임 로그**를 복사해 그대로 프롬프트에 제공했습니다. 에셋을 구체적으로 쥐여줌으로써, 에이전트가 문제의 본질(예: Webpack 번들링 제외 필요성 등)에만 집중하도록 통제했습니다.

### 6. 예외 처리 로직 고도화 및 사용자 피드백 메커니즘 구축
다양한 외부 API(ElevenLabs, Google Translate, FFmpeg 등)가 조합된 파이프라인에서는 외부 요인으로 인한 실패(Token 초과, Rate Limit 등)가 발생할 확률이 높습니다. 에이전트에게 단순히 예외를 던지지 말고, **"에러 메시지의 키워드(`quota`, `429`, `timeout`)를 분석하여 사용자 친화적인(User-Friendly) 문구로 포맷팅하는 Catch 블록을 구현해 줘"**라고 구체적인 엣지 케이스 시나리오를 제시했습니다. 그 결과, 사용자 대시보드에서 장애의 원인을 투명하게 안내하여 서비스의 신뢰도와 사용자 경험(UX)을 프로덕션 레벨로 높일 수 있었습니다.

### 7. 테스트 모드(Crop) 구축을 통한 자원 최적화 및 리뷰어 환경 제공
영상의 STT/번역/TTS 파이프라인 전체를 구동하면, 대용량 파일일수록 막대한 AI 토큰 비용과 네트워크 단위의 타임아웃 오류(Vercel 서버리스 환경 등)를 유발할 수 있습니다. 프론트엔드 대시보드 UI에 **'테스트 모드(처음 20초만 크롭)'** 체크박스를 추가하고, 백엔드 진입 시 `fluent-ffmpeg`의 `.setDuration(20)` 옵션을 동적으로 활성화하도록 파이프라인 구조를 확장시켰습니다. 이를 통해 코드 리뷰어나 테스터가 자원 제약 내에서도 정상 작동 여부를 빠르고 직관적으로 확신할 수 있게 되었습니다.

---

## 🔥 트러블슈팅 기록: 대용량 파일 업로드 한계 우회

### 🚧 문제 상황

검토자가 현실적인 크기의 영상(수십 MB 이상)을 업로드하여 더빙 파이프라인을 검증하고자 할 때, **Vercel Serverless Function의 기본 Payload 제한(4.5MB)**에 막혀 파일 전송 자체가 `413 Request Entity Too Large`로 실패하는 문제가 발생했습니다.

### ❌ 단순 해결책의 한계

가장 먼저 시도한 접근은 Vercel의 `next.config.js`나 API Route의 `bodyParser` 설정으로 최대 업로드 용량 자체를 늘리는 방법이었습니다. 그러나 이 제한은 **Vercel 플랫폼이 인프라 레벨에서 강제하는 물리적 상한선**이었기 때문에, 설정 변경만으로는 극복이 불가능했습니다.

### ✅ 최종 해결 아키텍처: 3단계 우회 전략

서버로 보내기 전, **브라우저 자체에서 먼저 영상을 20초로 크롭**하여 업로드 파일 크기를 한계 이하로 줄이는 "클라이언트 사이드 선처리(Edge Computing)" 방식을 도입했습니다.

**1단계: FFmpeg WASM 도입**

WebAssembly 기반의 `@ffmpeg/core`를 브라우저 메모리에서 구동하여 서버 없이 클라이언트 단에서 ffmpeg 명령어를 실행하는 파이프라인을 구축했습니다. 파일이 4.5MB를 초과하는 경우에만 조건부로 실행되도록 설계했습니다.

**2단계: Blob URL 변환을 통한 CORS 장벽 우회**

`classWorkerURL: await toBlobURL(...)` 방식으로 FFmpeg 내부 Web Worker 파일을 로컬 메모리의 Blob URL로 전환했습니다. 그러나 CDN 호스팅 스크립트는 내부적으로 하드코딩된 Chunk 로더(`814.ffmpeg.js`)를 직접 fetch하려 시도하기 때문에, 이 방법만으로는 브라우저의 **Cross-Origin Worker 보안 정책**을 완전히 통과할 수 없었습니다.

**3단계: FFmpeg 에셋 동일 출처(Same-Origin) 로컬 호스팅 (최종 해결)**

`ffmpeg.js`, `814.ffmpeg.js`, `index.js(util)` 파일을 **프로젝트 `public/ffmpeg/` 디렉토리에 직접 다운로드**하여 Vercel이 우리 앱의 정적 자원으로 서빙하도록 전환했습니다. 이로써 브라우저 입장에서는 모든 스크립트와 Worker가 동일 도메인(`ai-dubbing-service.vercel.app`)에서 비롯된 것으로 인식되어 CORS 정책을 완전히 통과하게 되었습니다.

```
// 외부 CDN 방식 (CORS 실패)
<Script src="https://unpkg.com/@ffmpeg/ffmpeg@0.12.6/dist/umd/ffmpeg.js" />

// 로컬 호스팅 방식 (Same-Origin, 성공 ✅)
<Script src="/ffmpeg/ffmpeg.js" />
```

**결과**: 수십 MB 이상의 영상도 브라우저 단에서 선처리(20초 크롭)를 완료한 후 2MB 이하의 경량 파일로 서버에 전달됩니다. 검토자는 파일 크기와 무관하게 테스트 모드로 더빙 파이프라인 전 과정이 정상 동작함을 확인할 수 있습니다.

---

## 🛡️ 예외 처리 및 사용자 피드백 체계

ElevenLabs, Google Translate, FFmpeg 등 다수의 외부 의존성으로 구성된 파이프라인은 외부 요인에 의한 다양한 실패 시나리오를 내포합니다. 파이프라인이 단순히 멈추는 대신, 에러 메시지의 키워드를 실시간으로 분석하여 아래 표와 같이 케이스를 분류하고 사용자에게 명확한 한국어 피드백을 제공합니다.

### 백엔드 API 에러 한국화 (route.ts Catch 블록)

| 엣지 케이스 | 에러 키워드 | 사용자에게 표시되는 문구 | HTTP Status |
|---|---|---|---|
| ElevenLabs API 토큰 과소진 | `quota`, `rate limit`, `insufficient` | "AI API 서비스(ElevenLabs)의 사용 한도(토큰)를 모두 소진했습니다. 관리자에게 문의하거나 결제 플랜을 확인해주세요." | 429 |
| API 키 유효하지 않음 / 인증 실패 | `api_key`, `unauthorized`, `401` | "API 키(Key)가 유효하지 않거나 만료되어 호출 권한이 없습니다. `.env` 파일 점검이 필요합니다." | 401 |
| Google Translate API 일일 할당량 초과 | `translate api limit`, `too many requests` | "번역 API 트래픽이 일일 할당량을 달성했습니다. 잠시 대기 후 다시 이용해주세요." | 429 |
| 미디어 파일 포맷 불호환 | `ffmpeg`, `extract` | "업로드한 미디어에서 오디오 트랙을 스캔할 수 없습니다. 다른 포맷의 파일을 사용해주세요." | 400 |
| 외부 AI 서버 장애 및 연결 실패 | `network`, `fetch`, `econnrefused` | "외부 AI 서버와의 연결이 불안정하여 타임아웃 오류가 발생했습니다. 잠시 후 다시 시도해주세요." | 502 |
| 서버리스 처리 시간 초과 | `timeout`, `timed out`, `duration` | "미디어 파이프라인 처리 시간이 지연되어 강제 중단되었습니다. 파일 크기나 해상도를 줄이는 것을 권장합니다." | 504 |
| 분류 불가 미상 예외 | 그 외 | "처리 중 다음 장애 사유로 중단되었습니다: {error.message}" | 500 |

### 프론트엔드 HTTP 응답 코드별 코너케이스 처리 (page.tsx Catch 블록)

서버가 비정상 JSON을 내려보낼 때(e.g., CDN/Proxy 개입 시간 초과 HTML 반환)를 대비하여, HTTP Status Code 기반으로 별도의 에러를 두 번 감지합니다.

| HTTP Status | 사용자에게 표시되는 문구 |
|---|---|
| `413` 또는 응답에 "Request Entity Too Large" 포함 | "Vercel 서버의 허용 용량(4.5MB)을 초과하여 파일 전송이 차단되었습니다. 테스트 모드 활성화 후 다시 시도해주세요." |
| `504` 또는 "TIMEOUT" 포함 | "서버 처리 시간이 지연되어 응답이 끊어졌습니다. 테스트 모드(20초 크롭)를 활용해주세요." |
| `401` / `403` | "로그인 세션이 만료되었거나 화이트리스트 접근 권한이 없는 계정입니다." |
| `500` 이상 | "서버 내부에서 예상치 못한 심각한 장애가 발생했습니다. 잠시 후 다시 시도해 주세요." |
| 비정상 JSON 파싱 실패 | "알 수 없는 응답 형식(비정상 JSON)을 서버로부터 받았습니다. 원본: {응답 앞부분}" |

> 프론트엔드에서는 파이프라인 **진행 중** 상태도 노란색 알림 박스(`⏳`)로 안내하기 때문에, 사용자가 언제나 어떤 단계에 있는지 실시간으로 파악할 수 있습니다. 오류 시에는 빨간색 박스(`🚨`)로 대체되는 시각적 구분이 적용되어 있습니다.

