import React from "react";
import { Home, MessageCircle, Users, Radio, Settings } from "react-feather";
import useStore from "../lib/store";

export default function BottomNav({ active, onNavigate }) {
  const { unread, onlineSet, rooms } = useStore();

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);
  const onlineCount = Math.max(0, onlineSet.size - 1);

  const tabs = [
    { id: "home",     icon: Home,     label: "Home",     badge: null },
    { id: "groups",   icon: Users,    label: "Groups",   badge: null },
    { id: "settings", icon: Settings, label: "Settings", badge: null },
  ];

  return (
    <div style={{
      position: "fixed",
      bottom: 0, left: 0, right: 0,
      height: 60,
      background: "var(--bg-sidebar)",
      borderTop: "1px solid var(--border)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-around",
      zIndex: 50,
      paddingBottom: "env(safe-area-inset-bottom)",
      backdropFilter: "blur(12px)",
    }}>
      {tabs.map(tab => {
        const Icon    = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onNavigate(tab.id)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              flex: 1,
              height: "100%",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              position: "relative",
              color: isActive ? "var(--accent)" : "var(--text-3)",
              transition: "var(--trans)",
            }}
          >
            {/* Active indicator */}
            {isActive && (
              <div style={{
                position: "absolute",
                top: 0, left: "25%", right: "25%",
                height: 2,
                background: "var(--accent)",
                borderRadius: "0 0 3px 3px",
                boxShadow: "0 0 8px var(--accent-glow)",
              }} />
            )}

            {/* Icon with badge */}
            <div style={{ position: "relative" }}>
              <Icon
                size={isActive ? 22 : 20}
                strokeWidth={isActive ? 2.5 : 1.8}
                style={{ transition: "var(--trans)" }}
              />
              {tab.badge && (
                <div style={{
                  position: "absolute",
                  top: -6, right: -8,
                  minWidth: 16, height: 16,
                  borderRadius: 8,
                  background: tab.badgeColor || "var(--red)",
                  color: "#fff",
                  fontSize: 9,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 4px",
                  border: "1.5px solid var(--bg-sidebar)",
                  boxShadow: tab.badgeColor === "var(--green)"
                    ? "0 0 6px var(--green)"
                    : "none",
                }}>
                  {tab.badge > 99 ? "99+" : tab.badge}
                </div>
              )}
            </div>

            <span style={{
              fontSize: 9,
              fontWeight: isActive ? 600 : 400,
              letterSpacing: 0.3,
              textTransform: "uppercase",
            }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
