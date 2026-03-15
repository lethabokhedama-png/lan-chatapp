import React from "react";

export default class ErrorBoundary extends React.Component {
  state = { error: null, info: null, showDetail: false };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error("[LAN Chat Crash]", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const { error, info, showDetail } = this.state;
    return (
      <div style={{
        position:"fixed", inset:0, background:"var(--bg-base)",
        display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center",
        padding:24, gap:16, zIndex:9999,
      }}>
        {/* Wrench icon — SVG, no emoji */}
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
          stroke="var(--red)" strokeWidth="1.5" strokeLinecap="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
        </svg>

        <div style={{ fontFamily:"var(--font-display)", fontSize:18,
          fontWeight:800, color:"var(--red)" }}>
          Something crashed
        </div>

        <div style={{
          fontFamily:"monospace", fontSize:12, color:"var(--text-2)",
          background:"var(--bg-raised)", padding:"10px 16px",
          borderRadius:"var(--radius)", maxWidth:340,
          border:"1px solid var(--border)", textAlign:"center",
        }}>
          {error.message}
        </div>

        {showDetail && (
          <div style={{
            fontFamily:"monospace", fontSize:10, color:"var(--text-3)",
            background:"var(--bg-base)", padding:"10px",
            borderRadius:"var(--radius)", maxWidth:"90vw", width:"100%",
            border:"1px solid var(--border)",
            maxHeight:200, overflowY:"auto", whiteSpace:"pre-wrap",
            wordBreak:"break-all",
          }}>
            {info?.componentStack || "No stack trace available"}
          </div>
        )}

        <div style={{ display:"flex", gap:10, flexWrap:"wrap", justifyContent:"center" }}>
          <button
            onClick={() => this.setState({ showDetail: !showDetail })}
            style={{
              display:"flex", alignItems:"center", gap:6,
              padding:"9px 18px",
              background:"var(--bg-raised)", border:"1px solid var(--border)",
              borderRadius:"var(--radius-sm)", color:"var(--text-2)",
              fontSize:13, cursor:"pointer", fontFamily:"var(--font-body)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
            {showDetail ? "Hide details" : "Show details"}
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding:"9px 18px",
              background:"linear-gradient(135deg,var(--accent),var(--accent2))",
              border:"none", borderRadius:"var(--radius-sm)",
              color:"#fff", fontSize:13, cursor:"pointer",
              fontFamily:"var(--font-body)",
              boxShadow:"0 4px 16px var(--accent-glow)",
            }}
          >
            Reload app
          </button>
        </div>

        <div style={{ fontSize:11, color:"var(--text-3)", textAlign:"center" }}>
          Check the browser console for full logs
        </div>
      </div>
    );
  }
}
