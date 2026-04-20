
import { useMemo, useState } from "react"
import type { Friend } from "./types"

interface WorkspaceSidebarProps {
  username: string
  rooms: string[]
  activeRoom: string
  activeDirectFriend: string
  newRoom: string
  newFriend: string
  friends: Friend[]
  selectedFriendForRoom: string
  roomMetaByRoom: Record<string, { owner: string, activeUsers: string[] }>
  status: "connecting" | "online" | "reconnecting" | "offline"
  unreadCountByRoom: Record<string, number>
  pendingIncomingRequests: string[]
  pendingOutgoingRequests: string[]
  onNewRoomChange: (value: string) => void
  onCreateRoom: () => void
  onSelectRoom: (room: string) => void
  onSelectDirectFriend: (friendUsername: string) => void
  onNewFriendChange: (value: string) => void
  onAddFriend: () => void
  onAcceptFriendRequest: (username: string) => void
  onRejectFriendRequest: (username: string) => void
  onSelectFriendForRoom: (value: string) => void
  onAddFriendToRoom: () => void
}

export const WorkspaceSidebar = ({
  username,
  rooms,
  activeRoom,
  activeDirectFriend,
  newRoom,
  newFriend,
  friends,
  selectedFriendForRoom,
  roomMetaByRoom,
  status,
  unreadCountByRoom,
  pendingIncomingRequests,
  pendingOutgoingRequests,
  onNewRoomChange,
  onCreateRoom,
  onSelectRoom,
  onSelectDirectFriend,
  onNewFriendChange,
  onAddFriend,
  onAcceptFriendRequest,
  onRejectFriendRequest,
  onSelectFriendForRoom,
  onAddFriendToRoom,
}: WorkspaceSidebarProps) => {
  const onlineFriends = useMemo(() => friends.filter((friend) => friend.online).length, [friends])
  const [modal, setModal] = useState<null | "room" | "friend">(null)

  return (
    <aside className="sidebar">
      <header className="panel-header">
        <h2>Rooms</h2>
        <p>Welcome, @{username}</p>
      </header>

      <div className="sidebar-actions-grid">
        <article className="sidebar-action-card">
          <strong>Create room</strong>
          <button onClick={() => setModal("room")} disabled={status !== "online"}>Open popup</button>
        </article>

        {modal && (
          <div className="action-modal-overlay" role="dialog" aria-modal="true">
            <div className="action-modal-content">
              <h3>{modal === "room" ? "Create Room" : "Add Friend"}</h3>
              <input
                value={modal === "room" ? newRoom : newFriend}
                onChange={(event) => (modal === "room" ? onNewRoomChange(event.target.value) : onNewFriendChange(event.target.value))}
                placeholder={modal === "room" ? "Room name" : "Friend username"}
                autoFocus
              />
              <div className="action-modal-buttons">
                <button
                  onClick={() => {
                    if (modal === "room") onCreateRoom()
                    else onAddFriend()
                    setModal(null)
                  }}
                  disabled={status !== "online" || !(modal === "room" ? newRoom.trim() : newFriend.trim())}
                >
                  Create
                </button>
                <button className="secondary" onClick={() => setModal(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
        <article className="sidebar-action-card">
          <strong>Add friend</strong>
          <button onClick={() => setModal("friend")} disabled={status !== "online"}>Open popup</button>
        </article>

        <article className="sidebar-action-card">
          <strong>Invite to room</strong>
          <div className="inline-form compact-inline">
            <select value={selectedFriendForRoom} onChange={(event) => onSelectFriendForRoom(event.target.value)}>
              <option value="">Select friend</option>
              {friends.map((friend) => (
                <option key={`invite-${friend.username}`} value={friend.username}>
                  @{friend.username} {friend.online ? "(online)" : "(offline)"}
                </option>
              ))}
            </select>
            <button onClick={onAddFriendToRoom} disabled={!activeRoom || !selectedFriendForRoom || status !== "online"}>
              Invite
            </button>
          </div>
          {!activeRoom && <small>Note: Select a room before sending an invite.</small>}
        </article>
      </div>

      <ul className="room-list">
        {rooms.length === 0 && <li className="empty-state">No rooms yet</li>}
        {rooms.map((room) => (
          <li key={room} className="room-entry">
            <button className={`room-item ${room === activeRoom ? "active" : ""}`} onClick={() => onSelectRoom(room)}>
              # {room}
              {unreadCountByRoom[room] > 0 && <span className="unread-badge">+{unreadCountByRoom[room]}</span>}
            </button>

            <p className="room-members-inline">
              {roomMetaByRoom[room]?.activeUsers?.length
                ? `In room: ${roomMetaByRoom[room].activeUsers.map((member) => `@${member}`).join(", ")}`
                : "In room: no active users"}
            </p>
          </li>
        ))}
      </ul>

      <header className="panel-header friends">
        <h3>Requests</h3>
        <p>{pendingIncomingRequests.length} incoming • {pendingOutgoingRequests.length} outgoing</p>
      </header>
      <ul className="request-list">
        {pendingIncomingRequests.length === 0 && <li className="empty-state">No pending requests</li>}
        {pendingIncomingRequests.map((requester) => (
          <li key={`incoming-${requester}`} className="request-row">
            <span>@{requester}</span>
            <div className="request-actions">
              <button onClick={() => onAcceptFriendRequest(requester)}>Accept</button>
              <button className="secondary" onClick={() => onRejectFriendRequest(requester)}>Reject</button>
            </div>
          </li>
        ))}
        {pendingOutgoingRequests.map((target) => (
          <li key={`outgoing-${target}`} className="request-row muted-row">
            <span>Waiting approval from @{target}</span>
          </li>
        ))}
      </ul>

      <header className="panel-header friends">
        <h3>Friends</h3>
        <p>{friends.length} added • {onlineFriends} online</p>
      </header>

      <ul className="friend-list">
        {friends.length === 0 && <li className="empty-state">No friends added yet</li>}
        {friends.map((friend) => (
          <li
            key={friend.username}
            className={activeDirectFriend === friend.username ? "active-direct" : ""}
            onClick={() => onSelectDirectFriend(friend.username)}

          >
            <span className="avatar">{friend.username.slice(0, 2).toUpperCase()}</span>
            <span>@{friend.username}</span>
            <span className={`presence ${friend.online ? "online" : "offline"}`}>{friend.online ? "online" : "offline"}</span>
          </li>
        ))}
      </ul>

      {modal && (
        <div className="action-modal-overlay" role="dialog" aria-modal="true">
          <div className="action-modal-content">
            <h3>{modal === "room" ? "Create Room" : "Add Friend"}</h3>
            <input
              value={modal === "room" ? newRoom : newFriend}
              onChange={(event) => (modal === "room" ? onNewRoomChange(event.target.value) : onNewFriendChange(event.target.value))}
              placeholder={modal === "room" ? "Room name" : "Friend username"}
              autoFocus
            />
            <div className="action-modal-buttons">
              <button
                onClick={() => {
                  if (modal === "room") onCreateRoom()
                  else onAddFriend()
                  setModal(null)
                }}
                disabled={status !== "online" || !(modal === "room" ? newRoom.trim() : newFriend.trim())}
              >
                Create
              </button>
              <button className="secondary" onClick={() => setModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {modal && (
        <div className="action-modal-overlay" role="dialog" aria-modal="true">
          <div className="action-modal-content">
            <h3>{modal === "room" ? "Create Room" : "Add Friend"}</h3>
            <input
              value={modal === "room" ? newRoom : newFriend}
              onChange={(event) => (modal === "room" ? onNewRoomChange(event.target.value) : onNewFriendChange(event.target.value))}
              placeholder={modal === "room" ? "Room name" : "Friend username"}
              autoFocus
            />
            <div className="action-modal-buttons">
              <button
                onClick={() => {
                  if (modal === "room") onCreateRoom()
                  else onAddFriend()
                  setModal(null)
                }}
                disabled={status !== "online" || !(modal === "room" ? newRoom.trim() : newFriend.trim())}
              >
                Create
              </button>
              <button className="secondary" onClick={() => setModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
