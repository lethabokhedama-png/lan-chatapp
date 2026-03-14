import React, { useState, useRef, useEffect } from "react";
import { Play, Pause } from "react-feather";

export default function VoicePlayer({ url, duration }) {
  const [playing, setPlaying]   = useState(false);
  const [current, setCurrent]   = useState(0);
  const [total, setTotal]       = useState(duration || 0);
  const audioRef = useRef(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime  = () => setCurrent(el.currentTime);
    const onMeta  = () => setTotal(el.duration || duration || 0);
    const onEnded = () => { setPlaying(false); setCurrent(0); };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("ended", onEnded);
    };
  }, []);

  function togglePlay() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else         { el.play();  setPlaying(true); }
  }

  function seek(e) {
    const el = audioRef.current;
    if (!el || !total) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct  = (e.clientX - rect.left) / rect.width;
    el.currentTime = pct * total;
  }

  function fmt(s) {
    if (!s || isNaN(s)) return "0:00";
    return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;
  }

  const pct = total ? (current / total) * 100 : 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 180 }}>
      <audio ref={audioRef} src={url} preload="metadata" />
      <button onClick={togglePlay} style={{
        width: 32, height: 32, borderRadius: "50%",
        background: "var(--accent)", border: "none", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff", flexShrink: 0,
      }}>
        {playing ? <Pause size={13} fill="white" /> : <Play size={13} fill="white" />}
      </button>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
        <div onClick={seek} style={{
          height: 3, background: "var(--border)", borderRadius: 2,
          cursor: "pointer", position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            width: `${pct}%`, background: "var(--accent)",
            transition: "width .1s linear",
          }} />
        </div>
        <div style={{ fontSize: 10, color: "var(--text-3)" }}>
          {fmt(current)} / {fmt(total)}
        </div>
      </div>
    </div>
  );
}
