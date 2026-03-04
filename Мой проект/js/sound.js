class SoundManager {
    constructor() {
        this.audioCtx = null;
        this.isMuted = false;
        this.masterGain = null;
        this.compressor = null;
        this.isPlaying = false;
        this.bpm = 110;
        this.lookahead = 25.0;
        this.scheduleAheadTime = 0.1;
        this.nextNoteTime = 0.0;
        this.currentNote = 0;
        this.timerID = null;

        // Full Retro Melody
        this.melody = [
            // Bar 1
            { note: 60, len: 0.5 }, { note: 0, len: 0.5 }, { note: 60, len: 0.5 }, { note: 63, len: 0.5 },
            { note: 65, len: 0.5 }, { note: 67, len: 0.5 }, { note: 65, len: 0.5 }, { note: 63, len: 0.5 },
            // Bar 2
            { note: 60, len: 0.5 }, { note: 0, len: 0.5 }, { note: 58, len: 0.5 }, { note: 55, len: 1.0 },
            { note: 0, len: 0.5 }, { note: 58, len: 0.5 }, { note: 60, len: 1.0 },
            // Bar 3
            { note: 67, len: 0.5 }, { note: 0, len: 0.5 }, { note: 67, len: 0.5 }, { note: 70, len: 0.5 },
            { note: 72, len: 0.5 }, { note: 70, len: 0.5 }, { note: 67, len: 0.5 }, { note: 65, len: 0.5 },
            // Bar 4
            { note: 63, len: 0.5 }, { note: 65, len: 0.5 }, { note: 67, len: 0.5 }, { note: 60, len: 2.0 },
            { note: 0, len: 0.5 }
        ];

        // Bassline
        this.bassLine = [
            36, 36, 36, 36, // C2
            31, 31, 33, 33, // G1, A1
            43, 43, 43, 43, // G2
            39, 39, 36, 36  // Eb2, C2
        ];
    }

    init() {
        if (this.audioCtx) return;

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();

            // Dynamics Compressor to prevent clipping at high volumes
            this.compressor = this.audioCtx.createDynamicsCompressor();
            this.compressor.threshold.value = -24;
            this.compressor.knee.value = 30;
            this.compressor.ratio.value = 12;
            this.compressor.attack.value = 0.003;
            this.compressor.release.value = 0.25;
            this.compressor.connect(this.audioCtx.destination);

            this.masterGain = this.audioCtx.createGain();
            // MAX VOLUME: 1.0 (Maximum possible)
            this.masterGain.gain.value = 1.0;
            this.masterGain.connect(this.compressor);

        } catch (e) {
            console.error("Web Audio API not supported", e);
        }
    }

    toggleMute() {
        if (!this.audioCtx) this.init();

        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        this.isMuted = !this.isMuted;

        if (this.isMuted) {
            this.stop();
            return false;
        } else {
            this.play();
            return true;
        }
    }

    play() {
        if (this.isPlaying || !this.audioCtx) return;

        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        this.isPlaying = true;
        this.currentNote = 0;
        this.nextNoteTime = this.audioCtx.currentTime + 0.1;
        this.scheduler();
    }

    stop() {
        this.isPlaying = false;
        window.clearTimeout(this.timerID);
    }

    scheduler() {
        if (!this.isPlaying) return;

        while (this.nextNoteTime < this.audioCtx.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.currentNote, this.nextNoteTime);
            this.nextNote();
        }
        this.timerID = window.setTimeout(this.scheduler.bind(this), this.lookahead);
    }

    nextNote() {
        const secondsPerBeat = 60.0 / this.bpm;
        const currentNoteData = this.melody[this.currentNote];
        const len = currentNoteData ? currentNoteData.len : 0.5;
        const duration = len * secondsPerBeat;

        this.nextNoteTime += duration;

        this.currentNote++;
        if (this.currentNote >= this.melody.length) {
            this.currentNote = 0;
        }
    }

    scheduleNote(noteIndex, time) {
        if (this.isMuted) return;

        const noteData = this.melody[noteIndex];
        if (noteData && noteData.note > 0) {
            // Melody: Square wave, High volume (0.5)
            this.playOscillator(noteData.note, time, noteData.len * (60 / this.bpm), 'square', 0.5);
        }

        // Bassline
        if (noteIndex % 2 === 0) {
            const bassIndex = Math.floor(noteIndex / 2) % this.bassLine.length;
            const bassNote = this.bassLine[bassIndex];
            // Bass: Triangle wave, Very High volume (0.7)
            this.playOscillator(bassNote, time, 60.0 / this.bpm, 'triangle', 0.7);
        }
    }

    playOscillator(midiNote, time, duration, type, vol) {
        if (!this.audioCtx) return;

        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = type;
        osc.frequency.value = 440 * Math.pow(2, (midiNote - 69) / 12);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(time);

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(vol, time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration * 0.9);

        osc.stop(time + duration);
    }

    // --- ЗВУКОВЫЕ ЭФФЕКТЫ ---

    playShoot() {
        if (!this.audioCtx) this.init();
        if (!this.audioCtx || this.isMuted) return;

        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        const t = this.audioCtx.currentTime;

        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.exponentialRampToValueAtTime(110, t + 0.1);

        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(t);
        osc.stop(t + 0.1);
    }

    playExplosion() {
        if (!this.audioCtx) this.init();
        if (!this.audioCtx || this.isMuted) return;

        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        const t = this.audioCtx.currentTime;

        // Noise buffer for explosion
        const bufferSize = this.audioCtx.sampleRate * 0.2; // 0.2 seconds
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.audioCtx.createBufferSource();
        noise.buffer = buffer;

        const gain = this.audioCtx.createGain();
        // Lowpass filter to make it "deep"
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        noise.start(t);
    }

    playDeath() {
        if (!this.audioCtx) this.init();
        if (!this.audioCtx || this.isMuted) return;

        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        const t = this.audioCtx.currentTime;

        // Brutal descending tone with harsh square wave
        const osc1 = this.audioCtx.createOscillator();
        const gain1 = this.audioCtx.createGain();

        osc1.type = 'square'; // Square wave for harsh, aggressive sound
        osc1.frequency.setValueAtTime(550, t); // Higher start for more impact
        osc1.frequency.exponentialRampToValueAtTime(40, t + 1.2); // Lower end, longer fall

        gain1.gain.setValueAtTime(0.6, t); // Louder
        gain1.gain.exponentialRampToValueAtTime(0.01, t + 1.2);

        osc1.connect(gain1);
        gain1.connect(this.masterGain);

        osc1.start(t);
        osc1.stop(t + 1.2);

        // Harsh noise burst for brutal impact
        const bufferSize = this.audioCtx.sampleRate * 0.4;
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);

        // More aggressive noise with slower decay
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
        }

        const noise = this.audioCtx.createBufferSource();
        noise.buffer = buffer;

        const noiseGain = this.audioCtx.createGain();
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400; // Lower frequency for more brutal sound
        filter.Q.value = 2; // Resonance for harshness

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        noiseGain.gain.setValueAtTime(0.6, t); // Louder
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.4); // Longer

        noise.start(t);
    }

    // --- ЗВУКОВЫЕ ЭФФЕКТЫ ДЛЯ АРКАНОИДА ---

    playPaddleBounce() {
        if (!this.audioCtx) this.init();
        if (!this.audioCtx || this.isMuted) return;

        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        const t = this.audioCtx.currentTime;

        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(440, t); // A4 note

        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(t);
        osc.stop(t + 0.08);
    }

    playBrickHit() {
        if (!this.audioCtx) this.init();
        if (!this.audioCtx || this.isMuted) return;

        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        const t = this.audioCtx.currentTime;

        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(660, t); // E5 note

        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(t);
        osc.stop(t + 0.1);
    }
}

window.soundManager = new SoundManager();
