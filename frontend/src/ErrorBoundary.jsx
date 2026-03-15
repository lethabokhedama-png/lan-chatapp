import React from "react";

export default class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div style={{
        position:"fixed",inset:0,background:"var(--bg-base)",
        display:"flex",flexDirection:"column",
        alignItems:"center",justifyContent:"center",
        padding:24,gap:12,
      }}>
        <div style={{fontSize:32}}>💥</div>
        <div style={{fontFamily:"var(--font-display)",fontSize:18,
          fontWeight:700,color:"var(--red)"}}>
          Something crashed
        </div>
        <div style={{
          fontFamily:"monospace",fontSize:11,color:"var(--text-3)",
          background:"var(--bg-raised)",padding:"12px 16px",
          borderRadius:"var(--radius)",maxWidth:340,
          wordBreak:"break-all",textAlign:"center",
          border:"1px solid var(--border)",
        }}>
          {this.state.error.message}
        </div>
        <button onClick={() => window.location.reload()} style={{
          padding:"10px 24px",background:"var(--accent)",
          border:"none",borderRadius:"var(--radius-sm)",
          color:"#fff",cursor:"pointer",fontSize:13,
          fontFamily:"var(--font-body)",
        }}>
          Reload
        </button>
      </div>
    );
    return this.props.children;
  }
}
