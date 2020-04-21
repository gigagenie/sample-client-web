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
 * 서버로부터 받은 URL 혹은 TTS 스트림 플레이
 */
const MEDIA_STOPPED = 0;
const MEDIA_PLAYING = 1;
const MEDIA_PAUSED = 2;

const CHANNEL_MEDIA = 101;

var playerDiv = document.getElementById('player');

/**
 * <video> 태그 엘리먼트
 */
class mediaElement {

    constructor() {
        this._el = document.createElement('video');
        playerDiv.appendChild(this._el);
        this._status = MEDIA_STOPPED;
        this._duration = 0;
        this._played = 0;
        this._notiTime = 0;
    }

    get duration() {
        return this._duration;
    }

    set duration(value) {
        this._duration = value;
    }

    get played() {
        return this._played;
    }

    set played(value) {
        this._played = value;
    }

    get notiTime() {
        return this._notiTime;
    }

    set notiTime(value) {
        this._notiTime = value;
    }

    get status() {
        return this._status;
    }
    
    set status(value) {
        this._status = value; 
    }

    get element() {
        return this._el;
    }

    play(url) {
        if (url)   this._el.src = url;
        this._el.play().catch((e) => console.log(e));
        this._status = MEDIA_PLAYING;
    }

    stop() {
        this._status = MEDIA_STOPPED;
        this._el.pause();
        this._el.src = '';
    }

    pause() {
        this._status = MEDIA_PAUSED;
        this._el.pause();
    }

    resume() {
        this._status = MEDIA_PLAYING;
        this._el.play();
    }
}

/**
 * URL 혹은 TTS 스트림 재생 관리
 */
export class Player {

    constructor(options) {
        this._mediaElements = [];
        this._mediaElementCount = (options && options.playerCount) || 2;

        // TTS 채널
        for (let i = 0; i < this._mediaElementCount; i++) {
            this._mediaElements.push(new mediaElement());
        }
        // 미디어 채널
        this._mediaElements[CHANNEL_MEDIA] = new mediaElement();
    }

    /**
     * TTS 재생
     * @param {ArrayBuffer} wav 재생할 TTS 음원
     * @param {Function} done Callback
     */
    playTTS(wav, done) {
        const intBuffer = new Int16Array(wav);
        const floatBuffer = new Float32Array(intBuffer.length);
        for (let i = 0; i < intBuffer.length; i++) {
            floatBuffer[i] = intBuffer[i] / 32768
        }

        // Safari - 22050hz 이하의 audioBuffer 지원하지 않음. 서버로부터 오는 wav 데이터는 16000hz이므로 사용 불가.
        const audioContext = new AudioContext();
        const audioBuffer = audioContext.createBuffer(1, floatBuffer.length, 16000);
        audioBuffer.copyToChannel(floatBuffer, 0);

        console.log(`[Player] playTTS() duration=${audioBuffer.duration}(sec) sampleRate=${audioBuffer.sampleRate}(Hz)`);

        const audioSource = audioContext.createBufferSource();
        audioSource.buffer = audioBuffer;
        audioSource.connect(audioContext.destination);
        audioSource.addEventListener('ended', () => {
            console.log(`[Player] playTTS() Ended`);
            done && done({
                status: 'complete',
                playTime: audioBuffer.duration,
                channel: 0
            });
        });
        audioSource.start();
    }

    /**
     * 미디어 재생
     * @param {Number} channel 미디어를 재생할 채널 번호
     * @param {String} url 미디어 URL
     * @param {Object} metaInfo 미디어 메타정보
     * @param {Array} notiTime 서버로 재생 상태를 전송해야 하는 시간
     * @param {Function} done Callback
     */
    play(channel, url, metaInfo = {}, notiTime = 0, done = {}) {
        const mediaElem = this._mediaElements[channel];
        const { contentType, infoDetail } = metaInfo;
        console.log(`[Player] play() channel=${channel}, contentType=${contentType}`);

        switch (contentType) {
            case 'music':
                mediaElem.duration = infoDetail.duration;
                mediaElem.played = 0;
                mediaElem.notiTime = notiTime;
                window.setMediaInfo(infoDetail);

                this.checkPlaytime(channel, 0, done);

                mediaElem.element.onended = () => {
                    console.log("The audio has ended");
                    mediaElem.status = MEDIA_STOPPED;
                    if (this._checkPlaytime)  clearInterval(this._checkPlaytime);
                    done && done({
                        status: 'complete',
                        playTime: mediaElem.played,
                        channel: channel
                    });
                }
                break;
            
            case 'radio':
                if (Hls.isSupported()) {
                    const hls = new Hls();
                    hls.loadSource(url);
                    hls.attachMedia(mediaElem.element);
                    hls.on(Hls.Events.MANIFEST_PARSED, () => mediaElem.play());
                } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                    mediaElem.element.src = src;
                    mediaElem.addEventListener('loadedmetadata', () => {
                        mediaElem.play();
                    });
                }
                window.setMediaInfo({ ...infoDetail, imageUrl: '../public/image/radio.jpeg' });
                done && done({
                    status: 'started',
                    playTime: 0,
                    channel: channel
                });
                return;
            
            case 'podcast':
                window.setMediaInfo({ ...infoDetail, imageUrl: '../public/image/podbbang.png' });
                break;
        }

        mediaElem.play(url);
        done && done({
            status: 'started',
            playTime: 0,
            channel: channel
        });
    }

    /**
     * 미디어 재생 중지
     * @param {Number} channel 채널 번호
     * @param {Function} done Callback
     */
    stop(channel, done) {
        console.log(`[Player] stop() channel=${channel}`);
        if (this._mediaElements[channel].status === MEDIA_PLAYING || this._mediaElements[channel].status === MEDIA_PAUSED) {
            this._mediaElements[channel].stop();
        }
        done && done({
            status: 'complete',
            playTime: this._mediaElements[channel].played || 0,
            channel: channel
        });
        if (this._checkPlaytime)  clearInterval(this._checkPlaytime);
    }

    /**
     * 미디어 재생 일시 정시
     * @param {Number} channel 채널 번호
     * @param {Function} done Callback
     */
    pause(channel, done) {
        console.log(`[Player] pause() channel=${channel}`);
        if (this._mediaElements[channel].status === MEDIA_PLAYING) {
            this._mediaElements[channel].pause();
        }
        done && done({
            status: 'paused',
            playTime: this._mediaElements[channel].played || 0,
            channel: channel
        });
        if (this._checkPlaytime)  clearInterval(this._checkPlaytime);
    }

    /**
     * 미디어 재생 재시작
     * @param {Number} channel 채널 번호
     * @param {Function} done Callback
     */    
    resume(channel, done) {
        const mediaElem = this._mediaElements[channel];
        console.log(`[Player] resume() channel=${channel}`);

        mediaElem.resume();
        this.checkPlaytime(channel, window.getMediaProgress(), done);
        done && done({
            status: 'started',
            playTime: 0,
            channel: channel
        });
    }

    /**
     * 서버로 미디어 플레이 시간 알림
     * @param {Number} channel 채널 번호
     * @param {Function} done Callback
     */       
    noti(channel, done) {
        done && done({
            status: 'noti',
            playTime: this._mediaElements[channel].played || 0,
            channel: channel
        });
    }

    /**
     * 음악 재생 시, 재생 시간 체크
     * @param {Number} channel 채널 번호
     * @param {Number} percentage 현재까지 재생된 시간 / 총 재생시간 * 100
     * @param {Function} done Callback
     */       
    checkPlaytime(channel, percentage, done) {
        this._checkPlaytime = setInterval(() => {
            const mediaElem = this._mediaElements[channel];
            mediaElem.played += 1;
            if (mediaElem.notiTime && mediaElem.notiTime.length > 0) {
                if (mediaElem.notiTime[0] === mediaElem.played) {
                    this.noti(channel, done);
                    mediaElem.notiTime.splice(0, 1);
                }
            }
            if (mediaElem.played >= mediaElem.duration && mediaElem.status === MEDIA_PLAYING) {
                this.stop(channel, done);
                return;
            }
            percentage = 100 * mediaElem.played / mediaElem.duration;
            window.setMediaProgress(percentage);
        }, 1000);
    }

    // channel 0 : tts
    /**
     * 
     * @param {Number} channel 
     * @param {String} cmd 
     * @param {Function} done Callback
     */
    actOnOther(channel, cmd, done) {
        const ret = { playTime: 0 };

        if (channel === 0) {
            const mediaChannelStatus = this._mediaElements[CHANNEL_MEDIA].status
            ret.channel = CHANNEL_MEDIA;
            if (mediaChannelStatus === MEDIA_PLAYING) {
                if (cmd == 'pause' || cmd == 'pauseR') {
                    this.pause(CHANNEL_MEDIA);
                    ret.status = 'paused';
                } else if (cmd == 'stop' || cmd == 'stopR') {
                    this.stop(CHANNEL_MEDIA);
                    ret.status = 'stopped';
                }
                done(ret);
            } else if (mediaChannelStatus === MEDIA_PAUSED) {
                if (cmd == 'resume') {
                    this.resume(CHANNEL_MEDIA);
                    ret.status = 'resumed';
                } else if (cmd == 'stop' || cmd == 'stopR') {
                    this.stop(CHANNEL_MEDIA);
                    ret.status = 'stopped';
                }
                done(ret);
            }
        }
    }
}
