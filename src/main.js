/*
 * Copyright 2020 KT AI Lab.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import { MService } from './mservice.js';
import { Recorder } from './recorder.js';
import { authorize, deauthorize } from './auth.js';

// 서버 연동에 필요한 설정 정보
const mconfig = {
    server: 'inside-dev.gigagenie.ai:30109',    // 서버 주소
}

// 화면 표시를 위한 서버 연동 상태 정보
const mstatus = {
    connected: 'Connected to AI Agent Server',
    connecting: 'Connecting...',
    disconnected: 'Disconnected from AI Agent Server'
}

// 화면 표시를 위한 음성 레코딩 상태 정보
const recstatus = {
    idle: 'Idle',
    recording: 'Recording...'
}


var mservice;
var recorder;
var audioContext;
var audioStream;

window.connStatus = function(status) {
    let statusString = document.getElementById('conn_status').lastChild.textContent;
    if (!status)    return statusString;
    document.getElementById('conn_status').lastChild.textContent = mstatus[status];
}

window.recStatus = function(status) {
    let statusString = document.getElementById('rec_status').lastChild.textContent;
    if (!status)    return statusString;
    document.getElementById('rec_status').lastChild.textContent = recstatus[status];   
}

// 알림 메시지를 통해 음성 명령에 대한 최종 결과를 화면에 표시
window.finalResult = function(mesg) {
    if (!mesg) return;
    allert(mesg, {
        type: 'success',
        icon: 'fa fa-comment', // Font Awesome 사용,
        duration: '10000'
    });
}

// 재생 중인 미디어 정보 표시
window.setMediaInfo = function(info) {
    document.getElementById("media_img").src = info.imageUrl || info.imageurl;
    document.getElementById("media_title").innerText = info.title;   
    document.getElementById("media_artist").innerText = info.artist || '';
    document.getElementById("media_playtime").innerText = info.duration ? (Math.floor(info.duration / 60) + ':' + ('0' + Math.floor(info.duration % 60)).slice(-2)) : '';
}

// 재생 중인 미디어 재생 시간 표시
window.setMediaProgress = function(percentage) {
    document.getElementsByClassName('progress-bar').item(0).setAttribute('aria-valuenow', percentage);
    document.getElementsByClassName('progress-bar').item(0).setAttribute('style','width:'+(percentage)+'%');
}

window.getMediaProgress = function() {
    return document.getElementsByClassName('progress-bar').item(0).getAttribute('aria-valuenow');
}

// 이벤트 핸들러 - 환경 설정 모달 팝업에서 저장 버튼을 눌렀을 경우
window.setConfig = async function() {
    mconfig.session = window.localStorage.getItem('session')
    if (!mconfig.session) {
        mconfig.session = libcrypto.randomBytes(8).toString("hex");
        window.localStorage.setItem('session', mconfig.session);
    }
    window.localStorage.removeItem('client');

    if (mservice && mservice.connected) {
        mservice.disconnect();
        const result = await deauthorize(mconfig.server, { ...mconfig.client, userid: mconfig.session });
        console.log(`[main] deauthorize result=${JSON.stringify(result)}`);
    }

    mconfig.client = {
        id: document.getElementById('input_client_id').value,
        key: document.getElementById('input_client_key').value,
        secret: document.getElementById('input_client_secret').value,
    }

    const result = await authorize(mconfig.server, { ...mconfig.client, userid: mconfig.session });
    console.log(`[main] authorize result=${JSON.stringify(result)}`);
    if (result && result.rc === 200) {
        mconfig.client.uuid = result.uuid;
    } else {
        console.error(`[main] authorize fail. rc=${result.rc}, rcmsg=${result.rcmsg}`);
        alert(`Failed to register to Server`);
        return;
    }

    window.localStorage.setItem('client', JSON.stringify(mconfig.client));
    
    if (mservice && mservice.connected) {
        console.log('[main] Reload page');
        location.reload();
    } else {
        startMService(mconfig);
    }
}

// 환경 설정 모달 팝업 보이기
window.showConfig = function() {
    const client = JSON.parse(window.localStorage.getItem('client'));
    if (client) {
        document.getElementById('input_client_id').value = client.id;
        document.getElementById('input_client_key').value = client.key;
        document.getElementById('input_client_secret').value = client.secret;
        document.getElementById('warning').style.display = 'none';
    } else {
        document.getElementById('warning').style.display = 'show';
    }

    const mdlSetting = document.getElementById('mdl_setting');
    mdlSetting.style.display = 'block';
    setTimeout(() => {
        mdlSetting.classList.add('show');
    }, 100);
}

// 환경 설정 모달 팝업 가리기
window.hideConfig = function() {
    const mdlSetting = document.getElementById('mdl_setting');
    mdlSetting.classList.remove('show');
    setTimeout(() => {
        mdlSetting.style.display = 'none';
    }, 100);
}

// 이벤트 핸들러 - 화면 로딩 
window.onload = function() {
    if (!window.localStorage) {
        alert(`Please use latest version of browser that supports localStorage`);
        return;
    }

    mediaAvailable()
    .then(stream => {
        audioStream = stream;
        audioContext = new AudioContext();
        console.log(`[main] getUserMedia success. audioContext sampleRate=${audioContext.sampleRate}`);

        // 환경설정 관련
        let needConfig = true;
        const client = JSON.parse(window.localStorage.getItem('client'));
        if (client) {
            if (client.id && client.key && client.secret) {
                needConfig = false;
                mconfig.client = { ...client };
                startMService(mconfig);
            }
        }
        if (needConfig) showConfig();

        document.getElementById('input_server_url').value = mconfig.server;
        document.getElementById('btn_mdl_save').addEventListener('click', (e) => {
            e.preventDefault();
            hideConfig();
        });
        document.getElementById('btn_modal').addEventListener('click', (e) => {
            e.preventDefault();
            showConfig();
        });

    })
    .catch(e => {
        console.error(`[main] getUserMedia fail. err = ${e}`);
        alert(`Your browser doesn\'t support getUserMedia!`);
        return;
    })
}

// 브라우저가 UserMedia를 지원하는지 여부 판단 -> 오디오 입력값을 받기 위해 반드시 필요
async function mediaAvailable() {
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    return await navigator.mediaDevices.getUserMedia({ audio: true });
}

// 서비스 시작
function startMService(options) {
    mservice = new MService(options);
    recorder = new Recorder(audioStream, audioContext);
    recorder.mservice = mservice;

    const btnCommand = document.getElementById('btn_command');
    btnCommand.addEventListener('click', requestVOCM);
    document.body.onkeypress = (e) => (e.keyCode === 32) && requestVOCM();  // 스페이스바 이벤트
}

// 음성명령 요청
function requestVOCM() {
    console.log(`requestVOCM()--------------------------------------------------`);
    if (window.recStatus() === recstatus.recording) recordStop();
    window.finalResult('');

    mservice.startVOCM();
    recorder.start();
}

function recordStop() {
    recorder.stop();
    mservice.cancelVOCM();
    window.recStatus('idle');
}
