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

import { timestamp } from './util.js';
import { Player } from './player.js';

/**
 * 인사이드 웹 클라이언트
 */
export class MService {

    constructor(options) {
        this._client = options.client;
        this._server = options.server;
        this._dssStatus = new Set(['SU:016','SU:027','SI:002','SG:000']);   // Launcher Main, HDMI COnnected, Remote Voice Input, Nobody Here
        this._authenticated = false;
        this._sendingStream = false;
        this._receivingStream = false;
        this._streamReadyCallback = null;

        this._retryCount = 0;

        this._player = new Player();
        this.connect();
    }

    get connected() {
        return this._authenticated;
    }

    /**
     * 인사이드 서버 접속
     */
    connect() {
        console.log(`[MService] connecting to server...`);
        this._retryCount++;
        window.connStatus('connecting');

        this._mclient = new WebSocket('wss://' + this._server, ['device-protocol']);
        this._mclient.onerror = (e) => this.onerror.call(this, e);
        this._mclient.onclose = (e) => this.onclose.call(this, e);
        this._mclient.onmessage = (e) => this.onmessage.call(this, e);
        this._mclient.onopen = (e) => this.onopen.call(this, e);
    }

    /**
     * 인사이드 서버 접속 해제
     */
    disconnect() {
        console.log('[MService] disconnecting from server...');
        this._mclient.close();
    }

    onopen(e) {
        console.log(`[MService] connected to mserver. uri=${this._server}`);
        this._retryCount = 0;
        window.connStatus('connected');
    }

    onerror(e) {
        console.error(`[MService] onerror() e:${JSON.stringify(e)}`);
    }

    onclose(e) {
        console.log(`[MService] onclose() e:${JSON.stringify(e)}`);
        this._authenticated = false;
        this._mclient = null;
        window.connStatus('disconnected');

    // TODO: error로 끊어진 것과 
    //    if (this._retryCount < 5)  this.connect();
    }

    onmessage(e) {
        if (!e.data)    return;

        // 인증 - 최초 접속 시
        if (!this._authenticated) {
            const msg = JSON.parse(e.data);
            console.log(`[MService] onmessage() auth message received. msg=${JSON.stringify(msg)}`);
//            if (msg.srvCommand.cmdOpt.errCode == 404)   

            if (msg.operation === 'WHO') {
                const time = timestamp();
                const auth_info = {
                    operation: 'IAM',
                    clienttype: 'GINSIDE',
                    clientuuid: this._client.uuid,
                    timestamp: time,
                    signature: libcrypto.createHmac('sha256', this._client.secret).update(`${this._client.id}:${this._client.key}:${time}`).digest('hex')
                }
                console.log(`[MService] onmessage() send auth message. msg=${JSON.stringify(auth_info, null, 4)}`);
                this._mclient.send(JSON.stringify(auth_info));
            } else if (msg.operation === 'WELCOME') {
                this._authenticated = true;
                this._mclient.binaryType = 'arraybuffer';
            }
            return;
        }
        this.parse(e.data);
    }

    /**
     * 서버로부터 수신된 메시지 파싱
     * @param {ArrayBuffer} msg 
     */
    async parse(arrayBuffer) {
        const buf = new Uint8Array(arrayBuffer);
        const op = buf[0];
        const size = (buf[1]<<16) + (buf[2]<<8) + buf[3];   // 3bytes
        console.log(`[MService] parse() received payload size:${size}`);

        if (op === 0x00) {          // command type
            const decoder = new TextDecoder();
            const view = new DataView(arrayBuffer, 4, size);
            const payload = decoder.decode(view);
            const msg = JSON.parse(payload).srvCommand || undefined;
            if (msg) {
                console.log(`[MService] onmessage() srvCommand. msgType=${msg.msgType} msgPayload=${msg.msgPayload}`);

                const msgPayload = JSON.parse(msg.msgPayload);
                if (await this.processSrvCommand(msg.msgType, msgPayload) && msgPayload.nextCmd !== undefined) {
                    await this.processSrvCommand(msgPayload.nextCmd, msgPayload.nextCmdOpt);
                }
            }
        } else if (op === 0x01) {   // stream type
            console.log(`[MService] onmessage() tts wav data received`);

            if (this._receivingStream) {
                if (this._streamReadyCallback && typeof this._streamReadyCallback === 'function') {
                    this._streamReadyCallback(arrayBuffer.slice(48));   // header 4bytes + wav header length 44bytes
                }
            }
        } else {
            console.error(`[MService] onmessage() unknown message`);
        }
    }

    /**
     * 서버 메시지 프로세스
     * @param {String} cmd 메시지 타입
     * @param {Object} msgPayload 메시지 내용 
     */
    async processSrvCommand(cmd, msgPayload) {
        const cmdOpt = msgPayload.cmdOpt;
        switch (cmd) {
            case 'Res_VOCM':    // 음성 인식 요청에 대한 응답 (rc: 200인 경우 음성인식 가능 상태)
                if (msgPayload.rc !== 200) window.finalResult('음성인식 실패');
                break;

            case 'Req_STRV':    // 음성 스트림 전송
                this._sendingStream = true;
                window.recStatus('recording')
                break;

            case 'Req_STPV':    // 음성 인식이 완료된 경우
                console.log(`[MService] processSrvCommand() Voice Command Result=${cmdOpt.uword}`);
                this._sendingStream = false;
                window.recStatus('idle');
                if (!cmdOpt.uword)  window.finalResult('음성인식 실패');
                break;

            case 'Req_PLMD':    // 미디어 플레이 요청
                this._player.actOnOther(cmdOpt.channel, cmdOpt.actOnOther, this.mediaCallback.bind(this));

                if (cmdOpt.channel === 101) {   // 채널 101: 미디어 플레이 (라디오, 팟캐스트, 지니뮤직 등)
                    this._player.play(cmdOpt.channel, cmdOpt.url, cmdOpt.metaInfo, cmdOpt.playNotiTime, this.mediaCallback.bind(this));
                } else {                        // TTS 플레이
                    this._streamReadyCallback = (data) => this._player.playTTS(data, this.mediaCallback.bind(this));
                    this._receivingStream = true;
                    window.finalResult(cmdOpt.metaInfo.mesg.replace('<ktml>', '').replace('</ktml>',''));
                }
                
                // DSS 상태 업데이트
                this.updateDssStatus(cmdOpt.setDssStatus, cmdOpt.clearDssStatus)
                break;

            case 'Req_UPMD':    // 미디어 플레이 상태 업데이트 요청
                switch (cmdOpt.act) {
                    case 'stop':
                        this._player.stop(cmdOpt.channel, this.mediaCallback.bind(this));
                        break;

                    case 'pause':
                        this._player.pause(cmdOpt.channel, this.mediaCallback.bind(this));
                        break;

                    case 'resume':
                        this._player.resume(cmdOpt.channel, this.mediaCallback.bind(this));
                        break;
                }
                this.updateDssStatus(cmdOpt.setDssStatus, cmdOpt.clearDssStatus)
                break;

            case 'Req_UPDS':    // DSS 상태 업데이트 요청
                this.updateDssStatus(cmdOpt.setDssStatus, cmdOpt.clearDssStatus)
                break;
            
            case 'Req_OAuth':
                window.open(cmdOpt.oauth_url);
                break;

            case 'Snd_SVEV':    // 서버 이벤트 
                if (cmdOpt.type === 'servDisc') {
                    this.disconnect();
                    setTimeout(() => this.connect(), 5000);
                } else if (cmdOpt.type === 'standby') {

                }
                break;

            default:
                break;
        }
        return true;
    }

    /**
     * DSS 상태 업데이트
     * @param {Array} setList
     * @param {Array} clearList
     */
    updateDssStatus(setList, clearList) {
        if (setList) {
            for (const el of setList) {
                this._dssStatus.add(el)
            }
        } 
        if (clearList) {
            for (const el of clearList) {
                this._dssStatus.delete(el)
            }
        }
    }

    /**
     * 미디어 재생 이벤트 콜백 -> 서버 알림
     * @param {Object} options 
     */
    mediaCallback(options) {
        if (!options)   options = {};
        const payload = {
            cmdOpt: {
                status: options.status || 'complete',
                playTime: options.playTime || 0,
                channel: options.channel || 0
            }
        }
        this.sendMessage('Upd_MEST', JSON.stringify(payload))
    }

    /**
     * 서버로 음성 명령 데이터 전송
     * @param {Float32Array} payload 
     */
    sendStream(payload) {
        if (!this.connected)    return;

        if (this._sendingStream && this._authenticated) {
            const payloadLen = payload.length;
            const header = new Uint8Array(4);
            header[0] = 0x01;
            header[1] = payload.byteLength/2 >> 16;
            header[2] = (payload.byteLength/2 - (header[1] << 16)) >> 8;
            header[3] = payload.byteLength/2 - (header[1] << 16) - (header[2] << 8);

            const buf = new ArrayBuffer(4 + (payload.byteLength/2));
            const view = new DataView(buf);

            for (let i = 0; i < 4; i++) {
                view.setUint8(0 + i, header[i]);
            }

            for (let i = 0; i < payloadLen; i++) {
                let s = Math.max(-1, Math.min(1, payload[i]));
                view.setInt16((i * 2) + 4, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            }

            //console.log(`[MService] sendStream() length=${buf.byteLength}(bytes) buf[1]=${header[1]} buf[2]=${header[2]}`);
            this._mclient.send(view.buffer);
        }
    }

    /**
     * 서버로 텍스트 명령 전송
     * @param {String} type 메시지 타입
     * @param {Float32Array} payload 메시지 내용
     */
    sendMessage(type, payload) {
        if (!this.connected)    return;

        const msg = {
            devCommand: {
                msgType: type,
                msgPayload: payload
            }
        }

        console.log(`[MService] sendMessage() devCommand=${msg.devCommand.msgType} payload=${JSON.stringify(msg.devCommand.msgPayload, null, 4)}`);
        const msgstr = JSON.stringify(msg);
        const encoder = new TextEncoder();
        const msgbuf = encoder.encode(msgstr);

        const buf = new Uint8Array(4 + msgstr.length);
        buf[0] = 0x00;
        buf[1] = msgbuf.length >> 16;
        buf[2] = (msgbuf.length - (buf[1] << 16)) >> 8;
        buf[3] = msgbuf.length - (buf[1] << 16) - (buf[2] << 8);

        console.log(`[MService] sendMessage() length=${msgbuf.length}(bytes)`);
        buf.set(msgbuf, 4);
        this._mclient.send(buf);
    }

    /**
     * 서버로 음성 명령 요청 전송
     */
    startVOCM() {
        if (!this.connected)    return;
        this.sendMessage('Req_VOCM', JSON.stringify({
            cmdOpt: {},
            dssStatus: Array.from(this._dssStatus)  
        }));
    }

    cancelVOCM() {
        if (this._sendingStream) {
            this._sendingStream = false;
            this.sendMessage('Req_CAVM', JSON.stringify({
                cmdOpt: {},
            }));
        }
    }
}
