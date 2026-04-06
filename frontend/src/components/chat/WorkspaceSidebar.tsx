
import { useMemo } from "react"
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

  return (
    <aside className="sidebar">
      <header className="panel-header">
        <h2>Rooms</h2>
        <p>Welcome, @{username}</p>
      </header>

      <div className="sidebar-actions-grid">
        <article className="sidebar-action-card">
          <strong>Create room</strong>
          <div className="inline-form compact-inline">
            <input value={newRoom} onChange={(event) => onNewRoomChange(event.target.value)} placeholder="New room name" />
            <button onClick={onCreateRoom} disabled={!newRoom.trim() || status !== "online"}>Create</button>
          </div>
        </article>

        <article className="sidebar-action-card">
          <strong>Add friend</strong>
          <div className="inline-form compact-inline">
            <input value={newFriend} onChange={(event) => onNewFriendChange(event.target.value)} placeholder="username" />
            <button onClick={onAddFriend} disabled={!newFriend.trim() || status !== "online"}>Add</button>
          </div>
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
          <li key={room}>
            <button className={`room-item ${room === activeRoom ? "active" : ""}`} onClick={() => onSelectRoom(room)}>
              # {room}
              {unreadCountByRoom[room] > 0 && <span className="unread-badge">+{unreadCountByRoom[room]}</span>}
            </button>
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
    </aside>
  )
}
