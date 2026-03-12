import React from "react";

const initials = (u) => {
  if (!u) return "?";
  const name = u.display_name || u.username || "?";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
};

export default function Avatar({ user, size = "md", style = {} }) {
  const cls = `avatar avatar-${size}`;
  return (
    <div className={cls} style={style}>
      {user?.avatar
        ? <img src={user.avatar} alt={initials(user)} />
        : initials(user)}
    </div>
  );
}