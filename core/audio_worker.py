"""
TianYu Audio Worker — persistent process, always-open mic stream
"""
import sys
import json
import os
import threading
import warnings
import numpy as np
import sounddevice as sd
import scipy.io.wavfile as wav_writer

warnings.filterwarnings("ignore")

SAMPLE_RATE = 16000
TMP_WAV = os.path.join(os.environ.get('TEMP', '/tmp'), 'tianyu_recording.wav')

recording = False
audio_chunks = []
stream = None
model = None

def send(obj):
    print(json.dumps(obj), flush=True)

# ── Load model ────────────────────────────────────────────────────────────────
def load_model():
    global model
    try:
        from faster_whisper import WhisperModel
        send({"status": "loading", "message": "Loading Whisper..."})
        model = WhisperModel("small.en", device="cuda", compute_type="float16")
        send({"status": "ready", "message": "TianYu ready"})
    except Exception as e:
        try:
            from faster_whisper import WhisperModel
            model = WhisperModel("small.en", device="cpu", compute_type="int8")
            send({"status": "ready", "message": "TianYu ready (CPU)"})
        except Exception as e2:
            send({"status": "error", "message": f"Model load failed: {e2}"})
            sys.exit(1)

# ── Always-open stream — zero init delay ──────────────────────────────────────
def audio_callback(indata, frames, time, status):
    if recording:
        audio_chunks.append(indata.copy())

def open_stream():
    global stream
    stream = sd.InputStream(
        samplerate=SAMPLE_RATE,
        channels=1,
        dtype='int16',
        blocksize=512,         # tiny blocks = near-zero latency
        callback=audio_callback,
        device=None,
    )
    stream.start()
    send({"status": "stream_open"})

def start_recording():
    global recording, audio_chunks
    audio_chunks = []
    recording = True
    send({"status": "recording"})

def stop_recording():
    global recording
    recording = False

    if not audio_chunks:
        send({"status": "error", "message": "No audio captured"})
        return

    audio = np.concatenate(audio_chunks, axis=0)

    duration_s = len(audio) / SAMPLE_RATE
    if duration_s < 0.3:
        send({"status": "error", "message": "Too short — hold longer"})
        return

    # Prepend 300ms silence so VAD never clips the first syllable
    silence = np.zeros((int(SAMPLE_RATE * 0.3), 1), dtype='int16')
    audio = np.concatenate([silence, audio], axis=0)

    wav_writer.write(TMP_WAV, SAMPLE_RATE, audio)
    send({"status": "transcribing"})

    try:
        segments, info = model.transcribe(
            TMP_WAV,
            beam_size=5,
            temperature=0.0,
            vad_filter=True,
            vad_parameters=dict(
                min_silence_duration_ms=500,
                speech_pad_ms=600,   # pad 600ms around speech edges
                threshold=0.15,      # very low = catches quiet first syllables
            ),
            # Minimal prompt — no app names to avoid hallucination loops
            initial_prompt="TianYu.",
            language="en",
            condition_on_previous_text=False,
            no_speech_threshold=0.5,
            log_prob_threshold=-0.8,
            compression_ratio_threshold=1.8,  # halt if repetition detected
        )

        text = " ".join(s.text.strip() for s in segments).strip()

        # Safety check — catch runaway repetition
        words = text.split()
        if len(words) > 5:
            unique = len(set(words))
            if unique / len(words) < 0.3:   # >70% repeated words
                send({"status": "error", "message": "Transcription error — please try again"})
                return

        send({"status": "done", "text": text})

    except Exception as e:
        send({"status": "error", "message": f"Transcription failed: {e}"})

# ── Main loop ─────────────────────────────────────────────────────────────────
def main():
    load_model()
    open_stream()   # open mic ONCE, keep it open forever — no init delay

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
            cmd = msg.get("cmd")
            if cmd == "start":
                start_recording()
            elif cmd == "stop":
                t = threading.Thread(target=stop_recording)
                t.daemon = True
                t.start()
            elif cmd == "quit":
                break
        except Exception as e:
            send({"status": "error", "message": str(e)})

    if stream:
        stream.stop()
        stream.close()

if __name__ == "__main__":
    main()