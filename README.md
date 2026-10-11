# posecut · 러프 도구

체험판: https://ahncheer.github.io/posecut/

VRoid로 만든 3D 캐릭터(VRM)를 불러와 포즈·표정·카메라를 잡고, 컷 틀에 맞춰 웹툰 러프(초안)를 만드는 웹 도구.

## 실행

```bash
npm install
npm run dev      # 개발 서버 (http://localhost:5173)
npm test         # 단위 테스트
npm run build    # 배포용 빌드 → dist/
```

샘플 캐릭터를 쓰려면 `public/models/sample.vrm`을 직접 넣어 주세요 (저장소에는 올리지 않음, `public/models/README.md` 참고).

## 배포

`main` 브랜치에 push하면 GitHub Actions가 테스트 → 빌드 → GitHub Pages 배포를 한다.
처음 한 번만 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 바꿔 둔다.
주소: https://ahncheer.github.io/posecut/

## 구조

```
src/
├─ app/         화면 주소(라우터)
├─ pages/       내 원고 · 새 원고 · 원고 화면 · 컷 편집
├─ components/  공용 화면 조각 (페이지 그림, 등장인물 편집, 작품 설정 창)
├─ scene/       데이터 타입과 원고·컷 틀 계산 (순수 함수, 단위 테스트)
├─ storage/     브라우저 저장소(IndexedDB), 원고 파일 저장·열기, 복사·붙여넣기
└─ engine/      컷 편집 엔진 연결부
public/engine/  컷 편집 엔진 (1차: 프로토타입 cut-test를 그대로 사용)
tests/          브라우저 흐름 점검 (Playwright)
```

### 컷 편집 엔진

지금은 프로토타입 `public/engine/cut-test.html`을 iframe으로 띄우고 `src/engine/bridge.ts`의 `RoughEngine` 인터페이스(`load`, `exportScene`, `thumbnail`, `onChange`)로 주고받는다.
다음 단계에서 엔진을 `src/engine/` 아래 TypeScript 모듈(장면·포즈·손발 끌기·AI)로 옮기며, 그때도 이 인터페이스는 유지한다.

## 데이터

- 원고·작품·VRM 파일은 사용하는 브라우저의 IndexedDB에 저장된다. 다른 컴퓨터로 옮길 때는 원고 화면의 "원고 파일로 저장"(JSON)을 쓴다. VRM 파일은 크기 때문에 파일에 넣지 않는다.
- AI 기능의 API 키는 사용자의 브라우저에만 저장된다. 코드·저장소에 키를 넣지 않는다.
