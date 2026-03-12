import React from "react";
import useStore from "../../lib/store";

export default function TypingIndicator({ roomId }) {
  const { typing, userMap, user } = useStore();
  const uids = (typing[roomId] || []).filter(u => u !== user?.id);

  if (!uids.length) return <div className="typing-bar" />;

  const names = uids.slice(0, 3).map(u => userMap[u]?.display_name || "Someone");
  const label = uids.length === 1
    ? `${names[0]} is typing…`
    : uids.length <= 3
    ? `${names.join(", ")} are typing…`
    : `${names.slice(0, 2).join(", ")} and ${uids.length - 2} others are typing…`;

  return (
    <div className="typing-bar">
      <div className="typing-dots">
        <span /><span /><span />
      </div>
      <span>{label}</span>
    </div>
  );
}