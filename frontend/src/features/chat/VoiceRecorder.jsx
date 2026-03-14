import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Send, X, Play, Pause } from "react-feather";
import { emit } from "../../lib/socket";

const MAX_SECONDS = 300;

export default function VoiceRecorder({ roomId, onClose }) {
  const [state, setState]     = useState("idle"); // idle | recording | preview
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [playing, setPlaying]   = useState(false);

  const mediaRef    = useRef(null);
  const chunksRef   = useRef([]);
  const timerRef    = useRef(null);
  const audioElRef  = useRef(null);
  const blobRef     = useRef(null);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    mediaRef.current?.stream?.getTracks().forEach(t => t.stop());
  }, []);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr     = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRef.current  = mr;
      chunksRef.current = [];

      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        blobRef.current = blob;
        setAudioUrl(URL.createObjectURL(blob));
        setState("preview");
        stream.getTracks().forEach(t => t.stop());
      };

      mr.start(100);
      setState("recording");
      setSeconds(0);

      timerRef.current = setInterval(() => {
        setSeconds(s => {
          if (s + 1 >= MAX_SECONDS) { stopRecording(); return s; }
          return s + 1;
        });
      }, 1000);
    } catch (err) {
      alert("Microphone access denied");
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current);
    mediaRef.current?.stop();
  }

  function togglePlay() {
    if (!audioElRef.current) return;
    if (playing) { audioElRef.current.pause(); setPlaying(false); }
    else         { audioElRef.current.play();  setPlaying(true); }
  }

  async function sendVoice() {
    if (!blobRef.current) return;
    const BASE  = import.meta.env.VITE_API_URL || "";
    const token = localStorage.getItem("lanchat_token");
    const form  = new FormData();
    form.append("file", blobRef.current, `voice_${Date.now()}.webm`);
    form.append("room_id", roomId);
    form.append("type", "voice");

    try {
      const res  = await fetch(`${BASE}/api/uploads/voice`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form,
      });
      const meta = await res.json();
      emit.sendMsg({ roomId, content: "Voice note", type: "voice", fileId: meta.id,
        clientId: `tmp_${Date.now()}`, duration: seconds });
      onClose();
    } catch (err) {
      console.error("Voice upload failed", err);
    }
  }

  function fmt(s) {
    return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "8px 12px", background: "var(--bg-raised)",
      border: "1px solid var(--border)", borderRadius: 24,
      margin: "0 10px 8px",
    }}>
      {state === "idle" && (
        <>
          <button onClick={startRecording} style={{
            width: 38, height: 38, borderRadius: "50%",
            background: "var(--red)", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", boxShadow: "0 0 12px rgba(224,92,92,.4)",
            animation: "pulse 1.5s infinite",
          }}>
            <Mic size={16} />
          </button>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>Tap to record</span>
          <button className="icon-btn" onClick={onClose} style={{ marginLeft: "auto" }}>
            <X size={14} />
          </button>
        </>
      )}

      {state === "recording" && (
        <>
          <div style={{
            width: 10, height: 10, borderRadius: "50%",
            background: "var(--red)", animation: "pulse 1s infinite",
          }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--red)", minWidth: 44 }}>
            {fmt(seconds)}
          </span>
          <div style={{ flex: 1, height: 2, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              height: "100%", background: "var(--red)",
              width: `${(seconds / MAX_SECONDS) * 100}%`, transition: "width 1s linear",
            }} />
          </div>
          <button onClick={stopRecording} style={{
            width: 34, height: 34, borderRadius: "50%",
            background: "var(--bg-hover)", border: "1px solid var(--border)",
            cursor: "pointer", display: "flex", alignItems: "center",
            justifyContent: "center", color: "var(--text-2)",
          }}>
            <Square size={14} fill="currentColor" />
          </button>
        </>
      )}

      {state === "preview" && audioUrl && (
        <>
          <audio ref={audioElRef} src={audioUrl} onEnded={() => setPlaying(false)} />
          <button onClick={togglePlay} style={{
            width: 34, height: 34, borderRadius: "50%",
            background: "var(--accent)", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
          }}>
            {playing ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>{fmt(seconds)}</span>
          <div style={{ flex: 1 }} />
          <button className="icon-btn" onClick={() => { setState("idle"); setAudioUrl(null); }}>
            <X size={14} />
          </button>
          <button onClick={sendVoice} style={{
            width: 34, height: 34, borderRadius: "50%",
            background: "var(--accent)", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", boxShadow: "0 2px 10px var(--accent-glow)",
          }}>
            <Send size={14} />
          </button>
        </>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: .6; transform: scale(.92); }
        }
      `}</style>
    </div>
  );
}
