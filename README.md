SoundscapeManager クラス内でのファイルのロード

SoundscapeManager クラスに loadSound メソッドを追加し、このメソッドを使って各WAVファイルをロードし、AudioBuffer として保持します。


class SoundscapeManager {
    constructor(canvasId) {
        // ... 既存のプロパティ ...
        this.audioBuffers = {}; // ロードしたAudioBufferを格納するオブジェクト

        // 各サウンドの再生中のソースとゲインノードを保持するプロパティを追加
        this.birdSource = null;
        this.rainSource = null;
        this.waveSource = null;
        this.birdGainNode = null;
        this.rainGainNode = null;
        this.waveGainNode = null;
        // ...
    }

    async init() {
        // ... 既存のAudioContext初期化処理 ...
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // AudioEngineインスタンスの作成
        this.audioEngine = new AudioEngine(this.audioContext); // ここでAudioEngineを初期化

        // 各サウンドのゲインノードを作成し、AudioEngineのメインバスに接続
        // AudioEngineのbuildAudioGraphで作成されるmainBusに接続するように変更
        this.birdGainNode = this.audioContext.createGain();
        this.birdGainNode.connect(this.audioEngine.nodes.mainBus); // mainBusに接続
        this.rainGainNode = this.audioContext.createGain();
        this.rainGainNode.connect(this.audioEngine.nodes.mainBus); // mainBusに接続
        this.waveGainNode = this.audioContext.createGain();
        this.waveGainNode.connect(this.audioEngine.nodes.mainBus); // mainBusに接続

        // ここで必要なサウンドファイルをロード
        await this.loadSound('bird', 'sounds/bird.wav');
        await this.loadSound('rain', 'sounds/rain.wav');
        await this.loadSound('wave', 'sounds/wave.wav');
        // 必要に応じて他のサウンドもロード

        this.isInitialized = true; // 初期化が完了したことをマーク
        console.log("Techno Soundscape Manager and WAV sounds Initialized.");
        this.updateSoundParameters(); // 初期パラメータ更新
        // toggleSound() を直接呼び出すのではなく、ユーザーの操作に任せる
    }

    async loadSound(name, url) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            this.audioBuffers[name] = await this.audioContext.decodeAudioData(arrayBuffer);
            console.log(`Sound '${name}' loaded successfully.`);
        } catch (error) {
            console.error(`Error loading sound '${name}' from ${url}:`, error);
        }
    }

    // mapRange ヘルパー関数 (SoundscapeManager内に必ず定義)
    mapRange(value, inMin, inMax, outMin, outMax) {
        return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
    }

    // ... その他の既存メソッド ...
}


サウンドの再生と制御

toggleSound() メソッド（既存のサウンド開始/停止ボタンのハンドラ）と updateSoundParameters() メソッド内で、感情値 (valence や arousal) に基づいて、
これらのWAVファイルの再生を開始したり停止したり、音量（ゲイン）を調整したりします。

class SoundscapeManager {
    // ... 既存のコード ...

    toggleSound() {
        if (!this.isInitialized) return; 
        
        const button = document.getElementById('sound-toggle-button');
        const now = this.audioContext.currentTime;

        if (this.isPlaying) {
            // フェードアウト
            this.audioEngine.nodes.masterGain.gain.cancelScheduledValues(now);
            this.audioEngine.nodes.masterGain.gain.linearRampToValueAtTime(0, now + 0.5);
            button.textContent = "サウンドを開始";
            clearInterval(this.timers.sequencer);

            // WAVファイルの停止とソースの解放
            if (this.birdSource) { this.birdSource.stop(); this.birdSource = null; }
            if (this.rainSource) { this.rainSource.stop(); this.rainSource = null; }
            if (this.waveSource) { this.waveSource.stop(); this.waveSource = null; }
        } else {
            // フェードイン
            this.updateSoundParameters(); // 現在の感情パラメータを反映
            this.audioEngine.nodes.masterGain.gain.cancelScheduledValues(now);
            this.audioEngine.nodes.masterGain.gain.linearRampToValueAtTime(this.params.masterVolume, now + 0.5); 
            button.textContent = "サウンドを停止";
            this.startSequencer();

            // 再生開始時に各WAVサウンドをループ再生で開始
            // AudioBufferSourceNodeは一度再生すると終わりなので、ループさせる場合はloop=true
            // 既に再生中の場合は新たに作成しないようにチェック
            if (this.audioBuffers.bird && !this.birdSource) {
                this.birdSource = this.audioContext.createBufferSource();
                this.birdSource.buffer = this.audioBuffers.bird;
                this.birdSource.loop = true; // ループ再生
                this.birdSource.connect(this.birdGainNode);
                this.birdSource.start(0);
            }
            if (this.audioBuffers.rain && !this.rainSource) {
                this.rainSource = this.audioContext.createBufferSource();
                this.rainSource.buffer = this.audioBuffers.rain;
                this.rainSource.loop = true; // ループ再生
                this.rainSource.connect(this.rainGainNode);
                this.rainSource.start(0);
            }
            if (this.audioBuffers.wave && !this.waveSource) {
                this.waveSource = this.audioContext.createBufferSource();
                this.waveSource.buffer = this.audioBuffers.wave;
                this.waveSource.loop = true; // ループ再生
                this.waveSource.connect(this.waveGainNode);
                this.waveSource.start(0);
            }
        }
        this.isPlaying = !this.isPlaying;
    }

    updateSoundParameters() {
        if (!this.isInitialized || !this.audioEngine) return;
        const now = this.audioContext.currentTime;
        const t = 0.1; // パラメータ変化のタイム定数 (滑らかさ)

        // ジョグダイヤルの値をオーディオノードに適用 (既存の処理)
        this.audioEngine.nodes.masterGain.gain.setTargetAtTime(this.params.masterVolume, now, t);
        this.audioEngine.nodes.panner.pan.setTargetAtTime(this.params.pan, now, t);
        this.audioEngine.nodes.delay.delayTime.setTargetAtTime(this.params.delayTime, now, t);
        this.audioEngine.nodes.delayFeedback.gain.setTargetAtTime(this.params.delayFeedback, now, t);
        this.audioEngine.nodes.reverbWet.gain.setTargetAtTime(this.params.reverb, now, t);

        if (this.isPlaying) {
            // 感情値に基づいて各WAVサウンドのゲインを調整
            // birdGainNode, rainGainNode, waveGainNodeは`init()`で作成済み
            if (this.birdGainNode) {
                const birdGain = this.mapRange(this.arousal, -1, 1, 0, 1); // 覚醒度が高いほど鳥の声が大きく
                this.birdGainNode.gain.setTargetAtTime(birdGain, now, t);
            }
            if (this.rainGainNode) {
                const rainGain = this.mapRange(this.valence, -1, 1, 1, 0); // 快適度が低いほど雨音が大きく（反転）
                this.rainGainNode.gain.setTargetAtTime(rainGain, now, t);
            }
            if (this.waveGainNode) {
                const waveGain = this.mapRange(this.valence, -1, 1, 0, 1); // 快適度が高いほど波音が大きく
                this.waveGainNode.gain.setTargetAtTime(waveGain, now, t);
            }
        } else {
            // 再生停止時はゲインを0にする（フェードアウト後すぐに0にする）
            if (this.birdGainNode) this.birdGainNode.gain.setTargetAtTime(0, now, t);
            if (this.rainGainNode) this.rainGainNode.gain.setTargetAtTime(0, now, t);
            if (this.waveGainNode) this.waveGainNode.gain.setTargetAtTime(0, now, t);
        }
    }
    // ... その他の既存メソッド ...
}

