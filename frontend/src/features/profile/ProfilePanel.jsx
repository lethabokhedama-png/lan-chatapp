import React from "react";
import useStore from "../../lib/store";
import Avatar   from "../../ui/Avatar";

export default function ProfilePanel({ user: target }) {
  const { onlineSet, setProfilePanel, user: me } = useStore();
  const isSelf  = target?.id === me?.id;
  const online  = onlineSet.has(target?.id);

  if (!target) return null;

  return (
    <div className="profile-panel">
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="icon-btn" onClick={() => setProfilePanel(null)}>✕</button>
      </div>

      <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
        <Avatar user={target} size="xl" style={{ margin: "0 auto 12px" }} />
        <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700 }}>
          {target.display_name || target.username}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 3 }}>
          @{target.username}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
          gap: 5, marginTop: 7, fontSize: 12 }}>
          <div className={`dot ${online ? "online" : "offline"}`} style={{ width: 7, height: 7 }} />
          <span style={{ color: online ? "var(--green)" : "var(--text-3)" }}>
            {online ? "online" : "offline"}
          </span>
        </div>
      </div>

      {target.bio && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1,
            color: "var(--text-3)", marginBottom: 5 }}>Bio</div>
          <div style={{ fontSize: 13, color: "var(--text-2)" }}>{target.bio}</div>
        </div>
      )}

      <div>
        {[
          ["Member since", target.created_at?.slice(0, 10) || "—"],
          ["Email",        isSelf ? (target.email || "—") : "—"],
        ].map(([l, v]) => (
          <div key={l} style={{ display: "flex", justifyContent: "space-between",
            padding: "8px 0", borderBottom: "1px solid var(--border-light)", fontSize: 12 }}>
            <span style={{ color: "var(--text-3)" }}>{l}</span>
            <span>{v}</span>
          </div>
        ))}
      </div>

      {isSelf && (
        <button className="btn btn-ghost" style={{ width: "100%", marginTop: 16, fontSize: 12 }}
          onClick={() => { useStore.getState().openSettings("account"); useStore.getState().setProfilePanel(null); }}>
          Edit Profile
        </button>
      )}
    </div>
  );
}