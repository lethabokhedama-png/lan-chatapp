import React, { useEffect, useState } from "react";
import { getToken } from "../../lib/api";

const BASE = import.meta.env.VITE_API_URL || "";

const DEFAULTS = ["👍", "Ok!", "Thanks!", "On my way", "Be right back", "Got it"];

export default function SmartReplies({ lastMessage, onSelect, inputValue }) {
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    if (inputValue) { setSuggestions([]); return; }
    if (!lastMessage?.content) { setSuggestions(DEFAULTS.slice(0, 4)); return; }
    buildSuggestions(lastMessage).then(setSuggestions);
  }, [lastMessage?.id, !!inputValue]);

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
          whiteSpace: "nowrap", fontFamily: "var(--font-body)",
        }}
          onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
          onMouseLeave={e => e.currentTarget.style.background = "var(--bg-raised)"}
        >{r}</button>
      ))}
    </div>
  );
}

async function buildSuggestions(lastMessage) {
  const text = lastMessage.content.toLowerCase();
  const token = getToken();

  let learned = [];
  try {
    const res = await fetch(
      `${BASE}/api/dev/smart-replies?q=${encodeURIComponent(lastMessage.content)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.ok) learned = (await res.json()).suggestions || [];
  } catch (_) {}

  const context = [];
  if (text.includes("?"))                                      context.push("Yes", "No", "Not sure", "Let me check");
  if (/hello|hi|hey|sup/.test(text))                          context.push("Hey! 👋", "Hi!", "What's up?");
  if (/thanks|thank you|thx/.test(text))                      context.push("No problem!", "Anytime 😊", "You're welcome");
  if (/ok|okay|sure|cool/.test(text))                         context.push("👍", "Got it", "Sounds good");
  if (/where|when|what time/.test(text))                      context.push("On my way", "Be right there", "5 mins");
  if (/bye|later|goodbye|cya/.test(text))                     context.push("Bye! 👋", "See you!", "Later!");
  if (/how are you|what's up|wassup|hows it/.test(text))      context.push("I'm good!", "All good 😊", "Great, you?");
  if (/love|miss/.test(text))                                 context.push("❤️", "Miss you too", "Same 😊");
  if (/food|eat|hungry/.test(text))                           context.push("I'm hungry too", "Let's eat!", "What do you want?");

  const all = [...new Set([...learned, ...context, ...DEFAULTS])];
  return all.slice(0, 5);
}
