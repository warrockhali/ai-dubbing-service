# 🎤 AI 더빙 웹 서비스 (ESTsoft 인턴 과제)

## 📌 프로젝트 개요
Next.js(App Router) 기반으로 구축된 다국어 AI 더빙 서비스입니다. 
사용자의 미디어 파일을 업로드받아 **음성 추출 → 전사(STT) → 번역 → 음성 합성(TTS)** 단계로 이뤄진 자체 파이프라인을 제공합니다.

## 🛠 기술 스택
- **프레임워크**: Next.js 15 (App Router), TypeScript
- **데이터베이스/ORM**: Turso DB, Drizzle ORM
- **보안/인증**: NextAuth.js (Google OAuth), 이메일 화이트리스트 미들웨어
- **AI API**: ElevenLabs SDK (`@elevenlabs/node`)
- **스타일링**: Vanilla CSS 변유와 Glassmorphism 적용의 현대적 디자인 체계

## 🚀 실행 방법
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
3. 데이터베이스 푸시 및 시드 (초기 화이트리스트 구성)
   ```bash
   npx drizzle-kit push
   npx tsx src/lib/db/seed.ts
   ```
4. 로컬 서버 실행
   ```bash
   npm run dev
   ```

## 🤖 에이전트(Antigravity) 활용 방법 및 문제 해결 노하우

과제 수행 간 AI 코딩 에이전트(Antigravity)와 협업하며 부딪힌 엣지 케이스들과, 이를 에이전트가 주도적으로 해결한 기술적 노하우입니다.

### 1. 보안 및 평가 기준 준수 (PDF 차단)
초기 프로젝트 세팅 중에 `인턴과제_v2+1.pdf` 파일이 실수로 GitHub 원격 레포지토리에 추적될 뻔한 이슈가 발생했습니다. AI 에이전트는 이를 즉각 감지하고, **Git 캐시를 삭제(`git rm --cached`)**한 뒤 `.gitignore`의 인코딩을 UTF-8로 리팩토링하고 커밋을 Amend하여 민감한 과제 리소스가 외부에 유출되는 것을 차단했습니다.

### 2. 기술 스택 충돌 시 자동화된 우회 구성
초기 `create-next-app` 실행 시 이미 존재하는 폴더의 요구사항 파일들과 겹쳐 충돌이 발생, 설치 스크립트가 멈췄습니다. 에이전트는 즉흥적으로 임시 디렉토리(`temp-app`)에 Next.js 보일러플레이트를 생성한 이후 기존 폴더와 안전하게 **병합(Merge)하는 파이프라인 스크립트를 Powershell로 구축하여 우회 처리**함으로써 130MB 단위의 패키지를 무중단으로 세팅 완수했습니다. 

### 3. 미적(Aesthetics) 요건과 Vanilla CSS 최적화
Tailwind CSS에 의존하는 대신, **과제에 암시된 독자적이고 매력적인 커스텀 스타일링** 요건을 충족하기 위하여 에이전트가 직접 모던한 유리 질감(Glassmorphism)과 반응형 그라디언트 애니메이션 렌더링 효과를 순수 CSS(Vanilla CSS) 변수로 모듈화해 구축했습니다. 브라우저 성능 최적화에도 유리하게 설계했습니다.

### 4. GitHub SSH 푸시 자동화 추적
작업 중 `Password authentication` 제한으로 푸시가 거부되었습니다. 에이전트는 단순히 불가능함을 알리는데 그치지 않고 SSH 프로토콜 사용의 필요성과 해결방법을 제안하였으며, 유저가 SSH 키 설정을 마친 즉시 `git remote set-url origin` 명령을 통해 설정을 전환, 자동화된 버전 관리를 재정립했습니다.
