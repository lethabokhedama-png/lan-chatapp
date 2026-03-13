import React, { useEffect, useState } from "react";

// Loads common_replies.json from the API, also does context matching
const DEFAULT = ["👍", "Ok!", "Thanks!", "On my way", "Be right back", "Got it"];

export default function SmartReplies({ lastMessage, onSelect, inputValue }) {
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    if (inputValue) { setSuggestions([]); return; } // hide when typing
    buildSuggestions(lastMessage).then(setSuggestions);
  }, [lastMessage?.id, inputValue]);

  if (!suggestions.length || inputValue) return null;

  return (
    <div style={{
      display: "flex", gap: 6, padding: "4px 12px 0",
      overflowX: "auto", scrollbarWidth: "none", flexShrink: 0,
    }}>
      {suggestions.map(r => (
        <button key={r} onClick={() => onSelect(r)} style={{
          padding: "5px 13px", borderRadius: 20, flexShrink: 0,
          border: "1px solid var(--border)", background: "var(--bg-raised)",
          color: "var(--text-2)", fontSize: 12, cursor: "pointer",
          whiteSpace: "nowrap", transition: "var(--trans)",
          fontFamily: "var(--font-body)",
        }}
          onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
          onMouseLeave={e => e.currentTarget.style.background = "var(--bg-raised)"}
        >{r}</button>
      ))}
    </div>
  );
}

async function buildSuggestions(lastMessage) {
  if (!lastMessage?.content) return DEFAULT.slice(0, 4);

  const text = lastMessage.content.toLowerCase();

  // Try to load learned replies from DATA via API
  let learned = [];
  try {
    const res = await fetch(
      (import.meta.env.VITE_API_URL || "") + "/api/dev/smart-replies?q=" +
      encodeURIComponent(lastMessage.content),
      { headers: { Authorization: "Bearer " + localStorage.getItem("lanchat_token") } }
    );
    if (res.ok) {
      const data = await res.json();
      learned = data.suggestions || [];
    }
  } catch (_) {}

  // Context-aware rules
  const context = [];
  if (text.includes("?")) context.push("Yes", "No", "Not sure", "Let me check");
  if (text.includes("hello") || text.includes("hi") || text.includes("hey"))
    context.push("Hey! 👋", "Hi there!", "Hello!");
  if (text.includes("thanks") || text.includes("thank you"))
    context.push("No problem!", "Anytime 😊", "You're welcome");
  if (text.includes("ok") || text.includes("okay"))
    context.push("👍", "Got it", "Sure!");
  if (text.includes("where") || text.includes("when"))
    context.push("On my way", "Be right there", "5 minutes");
  if (text.includes("bye") || text.includes("later") || text.includes("goodbye"))
    context.push("Bye! 👋", "See you!", "Later!");
  if (text.match(/\bhow are you\b|\bwhat's up\b|\bwassup\b/))
    context.push("I'm good!", "All good 😊", "Great, you?");

  // Merge: learned first, then context, then defaults — deduplicate, max 5
  const all = [...new Set([...learned, ...context, ...DEFAULT])];
  return all.slice(0, 5);
}
