import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Send, X, Play, Pause } from "react-feather";
import { getToken } from "../../lib/api";
import { emit } from "../../lib/socket";

const MAX_SECONDS = 300;
const BASE = () => import.meta.env.VITE_API_URL || "";

// Pick a supported mime type
function getSupportedMime() {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4",
  ];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

export default function VoiceRecorder({ roomId, onClose }) {
  const [recState, setRecState] = useState("idle"); // idle | recording | preview | uploading
  const [seconds,  setSeconds]  = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [playing,  setPlaying]  = useState(false);
  const [error,    setError]    = useState(null);

  const mediaRef   = useRef(null);
  const chunksRef  = useRef([]);
  const timerRef   = useRef(null);
  const audioRef   = useRef(null);
  const blobRef    = useRef(null);
  const mimeRef    = useRef("");

  useEffect(() => () => {
    clearInterval(timerRef.current);
    stopStream();
  }, []);

  function stopStream() {
    mediaRef.current?.stream?.getTracks().forEach(t => t.stop());
    if (mediaRef.current?.state === "recording") {
      mediaRef.current.stop();
    }
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime   = getSupportedMime();
      mimeRef.current = mime;

      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
      mediaRef.current  = mr;
      chunksRef.current = [];

      mr.ondataavailable = e => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime || "audio/webm" });
        blobRef.current  = blob;
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setRecState("preview");
        stream.getTracks().forEach(t => t.stop());
      };

      mr.onerror = e => {
        setError("Recording error: " + e.error?.message);
        setRecState("idle");
      };

      // Request data every 250ms for reliability
      mr.start(250);
      setRecState("recording");
      setSeconds(0);

      timerRef.current = setInterval(() => {
        setSeconds(s => {
          if (s >= MAX_SECONDS - 1) { stopRecording(); return s; }
          return s + 1;
        });
      }, 1000);

    } catch (err) {
      if (err.name === "NotAllowedError") {
        setError("Microphone permission denied. Allow it in your browser settings.");
      } else if (err.name === "NotFoundError") {
        setError("No microphone found on this device.");
      } else {
        setError("Could not start recording: " + err.message);
      }
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current);
    if (mediaRef.current?.state === "recording") {
      mediaRef.current.stop();
    }
  }

  function togglePlay() {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  }

  async function sendVoice() {
    if (!blobRef.current) return;
    setRecState("uploading");

    const ext  = mimeRef.current.includes("ogg") ? "ogg"
               : mimeRef.current.includes("mp4") ? "m4a"
               : "webm";
    const file = new File([blobRef.current], `voice_${Date.now()}.${ext}`, {
      type: blobRef.current.type,
    });

    const form  = new FormData();
    form.append("file", file);
    form.append("duration", String(seconds));

    try {
      const token = getToken();
      const res   = await fetch(BASE() + "/api/uploads/voice", {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}` },
        body:    form,
      });
      const data = await res.json();
      const url  = data.url || data.file_url || "";

      emit.sendMsg({
        roomId,
        content:  url,
        type:     "voice",
        file_url: url,
        duration: seconds,
        clientId: `c_${Date.now()}`,
      });

      onClose();
    } catch (err) {
      setError("Upload failed: " + err.message);
      setRecState("preview");
    }
  }

  function discard() {
    stopStream();
    clearInterval(timerRef.current);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    onClose();
  }

  function fmtTime(s) {
    return `${Math.floor(s / 60).toString().padStart(2,"0")}:${(s % 60).toString().padStart(2,"0")}`;
  }

  return (
    <div style={{
      padding: "12px 16px",
      background: "var(--bg-surface)",
      borderTop: "1px solid var(--border)",
      flexShrink: 0,
    }}>
      {error && (
        <div style={{
          fontSize: 12, color: "var(--red)", marginBottom: 10,
          padding: "6px 10px", background: "rgba(224,92,92,.1)",
          border: "1px solid rgba(224,92,92,.3)", borderRadius: "var(--radius-sm)",
        }}>
          {error}
        </div>
      )}

      <div style={{ display:"flex", alignItems:"center", gap:12 }}>

        {recState === "idle" && (
          <>
            <button onClick={startRecording} style={{
              width: 48, height: 48, borderRadius:"50%",
              background:"linear-gradient(135deg,var(--accent),var(--accent2))",
              border:"none", cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow:"0 0 20px var(--accent-glow)",
            }}>
              <Mic size={22} color="#fff" />
            </button>
            <div style={{ flex:1, fontSize:13, color:"var(--text-3)" }}>
              Tap to start recording
            </div>
            <button className="icon-btn" onClick={discard}><X size={16} /></button>
          </>
        )}

        {recState === "recording" && (
          <>
            <div style={{
              width: 12, height: 12, borderRadius:"50%",
              background:"var(--red)", flexShrink:0,
              animation:"pulse 1s ease infinite",
              boxShadow:"0 0 8px var(--red)",
            }} />
            <div style={{ flex:1 }}>
              <div style={{ fontSize:16, fontWeight:700, color:"var(--text-1)",
                fontFamily:"monospace" }}>
                {fmtTime(seconds)}
              </div>
              <div style={{ fontSize:10, color:"var(--text-3)", marginTop:2 }}>
                Recording… {MAX_SECONDS - seconds}s remaining
              </div>
              {/* Waveform simulation */}
              <div style={{ display:"flex", alignItems:"center", gap:2, marginTop:4 }}>
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} style={{
                    width: 3, borderRadius: 2,
                    background: "var(--accent)",
                    height: Math.random() * 16 + 4,
                    opacity: 0.6 + Math.random() * 0.4,
                    animation: `wave ${0.5 + Math.random() * 0.5}s ease ${Math.random() * 0.3}s infinite alternate`,
                  }} />
                ))}
              </div>
            </div>
            <button onClick={stopRecording} style={{
              width: 44, height: 44, borderRadius:"50%",
              background:"rgba(224,92,92,.15)", border:"1px solid rgba(224,92,92,.4)",
              cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center",
              color:"var(--red)",
            }}>
              <Square size={18} />
            </button>
            <button className="icon-btn" onClick={discard}><X size={16} /></button>
          </>
        )}

        {recState === "preview" && (
          <>
            <button onClick={togglePlay} style={{
              width: 44, height: 44, borderRadius:"50%",
              background:"var(--bg-raised)", border:"1px solid var(--border)",
              cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center",
              color:"var(--accent)",
            }}>
              {playing ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <audio ref={audioRef} src={audioUrl}
              onEnded={() => setPlaying(false)} style={{ display:"none" }} />
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600, color:"var(--text-1)" }}>
                Voice note
              </div>
              <div style={{ fontSize:11, color:"var(--text-3)" }}>
                {fmtTime(seconds)} — tap to preview
              </div>
            </div>
            <button onClick={sendVoice} style={{
              width: 44, height: 44, borderRadius:"50%",
              background:"linear-gradient(135deg,var(--accent),var(--accent2))",
              border:"none", cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow:"0 0 16px var(--accent-glow)",
            }}>
              <Send size={18} color="#fff" />
            </button>
            <button className="icon-btn" onClick={discard}><X size={16} /></button>
          </>
        )}

        {recState === "uploading" && (
          <div style={{ flex:1, fontSize:13, color:"var(--text-3)" }}>
            Sending voice note…
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%,100% { opacity:1; transform:scale(1); }
          50% { opacity:.5; transform:scale(1.2); }
        }
        @keyframes wave {
          from { transform: scaleY(0.5); }
          to   { transform: scaleY(1.5); }
        }
      `}</style>
    </div>
  );
}
