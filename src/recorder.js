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

/**
 * 오디오 입력의 시작/중지 및 다운샘플링 지원
 */
export class Recorder {

    constructor(stream, context) {
        this._audioContext = context;
        this._recording = false;
        this._buffer = [];
        this._available = false;

        this.init(stream);
    }

    set mservice(value) {
        this._mservice = value;
    }

    /**
     * @param {MediaStream} stream 
     */
    init(stream) {
        this._audioInput = this._audioContext.createMediaStreamSource(stream);
        this._audioScriptNode = this._audioContext.createScriptProcessor(4096, 1, 1);  // bufferLen, inputChannels, outputChannels

        this._audioScriptNode.onaudioprocess = (e) => {
            if (!this._recording || !this._mservice.connected) return;

            this._mservice.sendStream(this.downsample(e.inputBuffer.getChannelData(0), e.inputBuffer.sampleRate, 16000));
        }
        this._available = true;
    }

    /**
     * 브라우저에서 사용하는 오디오 라이브러리의 기본 SampleRate를 서버에서 사용하는 SampleRate로 변환
     * @param {Float32Array} buf 입력 버퍼
     * @param {Number} originSampleRate 오리지널 SampleRate -> 44100
     * @param {Number} targetSampleRate 타겟 SampleRate -> 16000
     */
    downsample(buf, originSampleRate, targetSampleRate) {
        const sampleRateRatio = originSampleRate / targetSampleRate;    // 44100 / 16000
        const newLength = Math.round(buf.length / sampleRateRatio);

        const result = new Float32Array(newLength);
        let offsetResult = 0;
        let offsetBuffer = 0;
        while (offsetResult < result.length) {
            let nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
            let accum = 0;
            let count = 0;
            for (var i = offsetBuffer; i < nextOffsetBuffer && i < buf.length; i++) {
                accum += buf[i];
                count++;
            }
            result[offsetResult] = accum / count;
            offsetResult++;
            offsetBuffer = nextOffsetBuffer;
        }
        return result;
    }

    /**
     * 음성 레코딩 시작
     */
    start() {
        if (!this._available || this._recording)   return;

        console.log(`[Recorder] start()`);
        this._audioInput.connect(this._audioScriptNode);
        this._audioScriptNode.connect(this._audioContext.destination);
        this._recording = true;
    }

    /**
     * 음성 레코딩 중지
     */
    stop() {
        if (!this._available)   return;

        console.log(`[Recorder] stop()`);
        this._recording = false;
        this._audioInput.disconnect(this._audioScriptNode);
        this._audioScriptNode.disconnect(this._audioContext.destination);
        this._buffer = [];
    }

    /**
     * 음성 레코딩 일시정지
     */
    pause() {
        if (!this._available)   return;

        console.log(`[Recorder] pause()`);
        this._recording = false;
    }

    /**
     * 음성 레코딩 재시작
     */
    resume() {
        if (!this._available)   return;

        console.log(`[Recorder] resume()`);
        this._recording = true;
    }
}
