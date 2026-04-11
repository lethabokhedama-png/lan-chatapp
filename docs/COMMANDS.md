# Dev Console Commands

## Query Commands (?)
| Command | Args | Description |
|---------|------|-------------|
| ?help | | Show all commands |
| ?status | | Server status and uptime |
| ?users | | List all registered users |
| ?user | @username | Full details for one user |
| ?rooms | | List all rooms |
| ?room | <name_or_id> | Room details and member list |
| ?messages | <room> | Last 10 messages in a room |
| ?online | | Who is online right now |
| ?flags | | All feature flags |
| ?flag | <key> | Value of one flag |
| ?bans | | List all active bans |
| ?ping | | API response time |
| ?socket | | Socket connection state |
| ?env | | IP, ports, config |
| ?disk | | DATA folder disk usage |
| ?uptime | | Server uptime |
| ?profile | @username | Full profile dump |
| ?echo | <text> | Echo text back |

## Action Commands (!)
| Command | Args | Description |
|---------|------|-------------|
| !kick | @username | Force disconnect (can reconnect) |
| !ban | @username <reason> .<duration> | Ban user — see duration syntax below |
| !unban | @username | Remove a ban |
| !delete | @username | Delete account permanently |
| !promote | @username | Give dev role |
| !demote | @username | Remove dev role |
| !rename | @username <name> | Change display name |
| !setbio | @username <bio> | Change bio |
| !resetpw | @username <pw> | Reset password |
| !wipe | @username | Delete all messages from user |
| !ghost | on\|off | Toggle ghost mode |
| !flag | <key> <value> | Set a feature flag |
| !broadcast | <message> | System message to ALL rooms |
| !msg | <room> <message> | System message to one room |
| !announce | <message> | Broadcast + browser notification |
| !motd | <message> | Set message of the day |
| !maintenance | on\|off | Block all logins |
| !purge | <room> | Delete all messages in a room |
| !close | <room> | Delete a room permanently |
| !lock | <room> | Lock a room |
| !unlock | <room> | Unlock a room |
| !rename-room | <id> <name> | Rename a room |
| !addmember | <room> @username | Add user to group |
| !removemember | <room> @username | Remove user from group |
| !export | <room> | Export messages to storage |
| !gc | | Remove unused uploads |
| !backup | | Copy DATA/ to storage |
| !resetflags | | Reset all flags to defaults |
| !reload | | Notify users to reload |
| !stats-reset | | Clear audit logs |
| !theme | <name> | Switch your theme |
| !clear | | Clear console |

## Ban Duration Syntax
