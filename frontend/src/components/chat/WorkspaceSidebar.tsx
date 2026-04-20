
import { useMemo } from "react"
import { AppIcon } from "../common/AppIcon"
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

  return (
    <aside className="sidebar">
      <header className="panel-header">
        <h2>Rooms & Friends</h2>
        <p>Welcome, @{username}</p>
      </header>

      <div className="sidebar-actions-grid">
        <article className="sidebar-action-card">
          <strong>Create room</strong>
          <div className="inline-form compact-inline">
            <input
              value={newRoom}
              onChange={(event) => onNewRoomChange(event.target.value)}
              placeholder="Room name"
            />
            <button onClick={onCreateRoom} disabled={status !== "online" || !newRoom.trim()} aria-label="Create room">
              <AppIcon name="plus" />
            </button>
          </div>
        </article>
        <article className="sidebar-action-card">
          <strong>Add friend</strong>
          <div className="inline-form compact-inline">
            <input
              value={newFriend}
              onChange={(event) => onNewFriendChange(event.target.value)}
              placeholder="Friend username"
            />
            <button onClick={onAddFriend} disabled={status !== "online" || !newFriend.trim()} aria-label="Add friend">
              <AppIcon name="userPlus" />
            </button>
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
            <button onClick={onAddFriendToRoom} disabled={!activeRoom || !selectedFriendForRoom || status !== "online"} aria-label="Invite friend to room">
              <AppIcon name="invite" />
            </button>
          </div>
          {!activeRoom && <small>Note: Select a room before sending an invite.</small>}
        </article>
      </div>

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
              <button onClick={() => onAcceptFriendRequest(requester)} aria-label={`Accept @${requester}`}>
                <AppIcon name="check" />
              </button>
              <button className="secondary" onClick={() => onRejectFriendRequest(requester)} aria-label={`Reject @${requester}`}>
                <AppIcon name="close" />
              </button>
            </div>
          </li>
        ))}
        {pendingOutgoingRequests.map((target) => (
          <li key={`outgoing-${target}`} className="request-row muted-row">
            <span>Waiting approval from @{target}</span>
          </li>
        ))}
      </ul>
    </aside>
  )
}
