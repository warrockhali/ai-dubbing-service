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
