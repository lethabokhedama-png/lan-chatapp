import React from "react";
import Sidebar      from "../ui/Sidebar";
import ChatWindow   from "../features/chat/ChatWindow";
import ProfilePanel from "../features/profile/ProfilePanel";
import useStore     from "../lib/store";

export default function ChatPage() {
  const { activeRoom, profilePanel } = useStore();

  return (
    <>
      <Sidebar />
      <div className="chat-area">
        {activeRoom
          ? <ChatWindow room={activeRoom} />
          : <EmptyState />}
      </div>
      {profilePanel && <ProfilePanel user={profilePanel} />}
    </>
  );
}

function EmptyState() {
  return (
    <div className="empty-state" style={{ flex: 1 }}>
      <div className="empty-icon">⬡</div>
      <div className="empty-title">LAN Chat</div>
      <div className="empty-sub">
        Select a channel or start a direct message to begin chatting on your local network.
      </div>
    </div>
  );
}