# Sample Client Web

본 프로젝트는 **GiGA Genie Inside(이하, G-INSIDE)** API의  `websocket`, `REST` 규격에 맞추어 개발된 Web 샘플 클라이언트입니다.



## GiGA Genie Inside

`G-INSIDE`는 3rd party 개발자가 자신들의 제품(단말 장치, 서비스, 앱 등)에 KT의 AI Platform인 `기가지니`를 올려서 음성인식과 자연어로 제어하고 `기가지니`가 제공하는 서비스(생활비서, 뮤직, 라디오 등)를 사용할 수 있도록 해 줍니다. `G-INSIDE`는 기가지니가 탑재된 제품을 개발자들이 쉽게 만들 수 있도록 개발 도구와 문서, 샘플 소스 등 개발에 필요한 리소스를 제공합니다.



## Sample Client Web 개요

**Sample Client Web** 에 구현되어 있는 기능은 다음과 같습니다.

- 디바이스 키 인증
- 음성을 이용한 대화
  - 마이크(mic) 제어
  - ServiceM RPC command 일부 지원



다른 언어의 샘플은 https://github.com/gigagenie 에서 확인할 수 있습니다.



### 브라우저 지원

- `Chrome` ver.55 이상

- `Firefox` ver.53 이상

  

## 사전 준비 사항

### 인사이드 디바이스 키 발급

1. API Link (https://apilink.kt.co.kr) 회원가입
2. 사업 제휴 신청 및 디바이스 등록 (Console > GiGA Genie > 인사이드 디바이스 등록)
3. 디바이스 등록 완료 후 My Device에서 등록한 디바이스 정보 및 개발키 발급 확인 (Console > GiGA Genie > My Device)
4. 발급된 개발 키를 Sample Client Web 화면의 설정 팝업창을 통해 등록



## 시작하기

### 패키지 설치

#### node.js

https://node.js.org 에서 LTS Version의 node.js를 다운받고 설치합니다.

#### node_modules 

```shell
$ cd [프로젝트 폴더]
$ npm install
```



### 서버 실행

```shell
$ npm run start
```



### 테스트

```
http://localhost:8000
```



## 라이선스

**Sample Client Web** is licensed under the [Apache License 2.0](http://www.apache.org/licenses/LICENSE-2.0).

