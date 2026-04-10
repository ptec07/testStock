# Stock Window Compare

회사명 또는 날짜를 입력하면 다음 두 구간을 비교해서 보여주는 바닐라 웹앱입니다.

- 기준 날짜 전후 7일 주가 구간
- 1년 전 동일 날짜 기준 전후 7일 주가 구간

프레임워크 없이 **HTML / CSS / JavaScript** 만 사용했습니다.
브라우저에서 Yahoo Finance를 직접 호출하면 CORS 이슈가 생기므로 `server.py`가 간단한 프록시 역할을 합니다.

---

## 기능

- 회사명 / 티커 / 한국 6자리 종목코드 검색
- 한국 주식 검색 보강
  - 예: `삼성전자`, `005930`, `005930.KS`
- 기준일 전후 7일 가격 비교
- 1년 전 동일 구간 비교
- 정규화 오버레이 그래프 제공
- 선택 종목의 거래소 / 통화 / 거래일 수 표시
- 순수 SVG 기반 그래프 렌더링

---

## 폴더 구조

```text
stock/
├── index.html
├── style.css
├── app.js
├── server.py
├── start.sh
└── README.md
```

---

## 실행 방법

### 방법 1: start.sh 사용

```bash
cd /home/ptec07/hermes/stock
./start.sh
```

기본 포트는 `8080` 입니다.

### 방법 2: python 서버 직접 실행

```bash
cd /home/ptec07/hermes/stock
python3 server.py
```

포트를 변경하려면:

```bash
PORT=8081 python3 server.py
```

브라우저 접속:

```text
http://localhost:8080
```

포트를 바꿨다면 그 포트로 접속하면 됩니다.

---

## 사용 예시

검색창에 아래처럼 입력할 수 있습니다.

- 미국 주식: `AAPL`, `TSLA`, `Apple`
- 한국 주식: `삼성전자`, `005930`, `005930.KS`
- 한국 주식 추가 예시: `SK하이닉스`, `NAVER`, `카카오`

---

## 기술 메모

### 왜 서버가 필요한가?
Yahoo Finance API는 브라우저에서 직접 호출 시 CORS 제한이 발생할 수 있습니다.
그래서 `server.py`가 아래 요청을 중계합니다.

- `/api/search`
- `/api/chart`

### 차트 구현 방식
- 외부 프레임워크 없음
- SVG를 JS로 직접 생성
- 선택 구간 2개 + 정규화 오버레이 1개 제공

---

## Render 배포

이 프로젝트는 `render.yaml` 블루프린트와 `requirements.txt`를 포함해 Render에 바로 올릴 수 있게 준비되어 있습니다.

### Render에서 배포하는 방법

1. 이 폴더를 GitHub 저장소에 올립니다.
2. Render 대시보드에서 **New + → Blueprint** 를 선택합니다.
3. 방금 올린 GitHub 저장소를 연결합니다.
4. Render가 `render.yaml`을 읽고 웹 서비스를 생성합니다.
5. 배포가 끝나면 Render가 발급한 URL로 접속합니다.

### Render 설정값

- Build Command: `pip install -r requirements.txt`
- Start Command: `python3 server.py`
- Health Check Path: `/`
- Port: Render가 주입하는 `PORT` 환경변수를 자동 사용

---

## 검증

다음 항목으로 점검할 수 있습니다.

```bash
cd /home/ptec07/hermes/stock
python3 -m py_compile server.py
node --check app.js
python3 -m pytest tests/test_render_deploy.py -q
```

---

## 주의

- Yahoo Finance 응답 구조가 바뀌면 일부 검색/차트가 영향을 받을 수 있습니다.
- 본 서비스는 투자 참고용 UI이며 투자 판단 책임은 사용자에게 있습니다.
