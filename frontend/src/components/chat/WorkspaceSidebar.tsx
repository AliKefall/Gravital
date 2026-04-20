import { useMemo } from "react"
import { AppIcon } from "../common/AppIcon"
import type { Friend } from "./types"

interface WorkspaceSidebarProps {
  username: string
  rooms: string[]
  activeRoom: string
  pendingRoom: string
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
  language: "en" | "tr"
  onNewRoomChange: (value: string) => void
  onCreateRoom: () => void
  onSelectRoom: (room: string) => void
  onJoinSelectedRoom: () => void
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
  pendingRoom,
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
  language,
  onNewRoomChange,
  onCreateRoom,
  onSelectRoom,
  onJoinSelectedRoom,
  onSelectDirectFriend,
  onNewFriendChange,
  onAddFriend,
  onAcceptFriendRequest,
  onRejectFriendRequest,
  onSelectFriendForRoom,
  onAddFriendToRoom,
}: WorkspaceSidebarProps) => {
  const onlineFriends = useMemo(() => friends.filter((friend) => friend.online).length, [friends])
  const isEnglish = language === "en"

  return (
    <aside className="sidebar">
      <header className="panel-header">
        <h2>{isEnglish ? "Rooms & Friends" : "Odalar ve Arkadaşlar"}</h2>
        <p>{isEnglish ? `Welcome, @${username}` : `Hoş geldin, @${username}`}</p>
      </header>

      <div className="sidebar-actions-grid">
        <article className="sidebar-action-card">
          <strong>{isEnglish ? "Create room" : "Oda oluştur"}</strong>
          <div className="inline-form compact-inline">
            <input
              value={newRoom}
              onChange={(event) => onNewRoomChange(event.target.value)}
              placeholder={isEnglish ? "Room name" : "Oda adı"}
            />
            <button onClick={onCreateRoom} disabled={status !== "online" || !newRoom.trim()} aria-label="Create room">
              <AppIcon name="plus" />
            </button>
          </div>
        </article>
        <article className="sidebar-action-card">
          <strong>{isEnglish ? "Add friend" : "Arkadaş ekle"}</strong>
          <div className="inline-form compact-inline">
            <input
              value={newFriend}
              onChange={(event) => onNewFriendChange(event.target.value)}
              placeholder={isEnglish ? "Friend username" : "Arkadaş kullanıcı adı"}
            />
            <button onClick={onAddFriend} disabled={status !== "online" || !newFriend.trim()} aria-label="Add friend">
              <AppIcon name="userPlus" />
            </button>
          </div>
        </article>

        <article className="sidebar-action-card">
          <strong>{isEnglish ? "Invite to room" : "Odaya davet et"}</strong>
          <div className="inline-form compact-inline">
            <select value={selectedFriendForRoom} onChange={(event) => onSelectFriendForRoom(event.target.value)}>
              <option value="">{isEnglish ? "Select friend" : "Arkadaş seç"}</option>
              {friends.map((friend) => (
                <option key={`invite-${friend.username}`} value={friend.username}>
                  @{friend.username} {friend.online ? (isEnglish ? "(online)" : "(çevrimiçi)") : (isEnglish ? "(offline)" : "(çevrimdışı)")}
                </option>
              ))}
            </select>
            <button onClick={onAddFriendToRoom} disabled={!activeRoom || !selectedFriendForRoom || status !== "online"} aria-label="Invite friend to room">
              <AppIcon name="invite" />
            </button>
          </div>
          {!activeRoom && <small>{isEnglish ? "Select and join a room before inviting." : "Davet için önce bir odaya katılın."}</small>}
        </article>
      </div>

      <header className="panel-header friends">
        <h3>{isEnglish ? "Friends" : "Arkadaşlar"}</h3>
        <p>{friends.length} {isEnglish ? "added" : "ekli"} • {onlineFriends} {isEnglish ? "online" : "çevrimiçi"}</p>
      </header>

      <ul className="friend-list">
        {friends.length === 0 && <li className="empty-state">{isEnglish ? "No friends added yet" : "Henüz arkadaş eklenmedi"}</li>}
        {friends.map((friend) => (
          <li
            key={friend.username}
            className={activeDirectFriend === friend.username ? "active-direct" : ""}
            onClick={() => onSelectDirectFriend(friend.username)}
          >
            <span className="avatar">{friend.username.slice(0, 2).toUpperCase()}</span>
            <span>@{friend.username}</span>
            <span className={`presence ${friend.online ? "online" : "offline"}`}>{friend.online ? (isEnglish ? "online" : "çevrimiçi") : (isEnglish ? "offline" : "çevrimdışı")}</span>
          </li>
        ))}
      </ul>

      <ul className="room-list">
        {rooms.length === 0 && <li className="empty-state">{isEnglish ? "No rooms yet" : "Henüz oda yok"}</li>}
        {rooms.map((room) => (
          <li key={room} className="room-entry">
            <button className={`room-item ${room === pendingRoom ? "active" : ""}`} onClick={() => onSelectRoom(room)}>
              # {room}
              {unreadCountByRoom[room] > 0 && <span className="unread-badge">+{unreadCountByRoom[room]}</span>}
            </button>

            <p className="room-members-inline">
              {roomMetaByRoom[room]?.activeUsers?.length
                ? `${isEnglish ? "In room" : "Odada"}: ${roomMetaByRoom[room].activeUsers.map((member) => `@${member}`).join(", ")}`
                : `${isEnglish ? "In room" : "Odada"}: ${isEnglish ? "no active users" : "aktif kullanıcı yok"}`}
            </p>
          </li>
        ))}
      </ul>
      <button className="join-room-button" onClick={onJoinSelectedRoom} disabled={!pendingRoom || status !== "online" || pendingRoom === activeRoom}>
        <AppIcon name="voice" />
        <span>{isEnglish ? "Join selected room" : "Seçili odaya gir"}</span>
      </button>

      <header className="panel-header friends">
        <h3>{isEnglish ? "Requests" : "İstekler"}</h3>
        <p>{pendingIncomingRequests.length} {isEnglish ? "incoming" : "gelen"} • {pendingOutgoingRequests.length} {isEnglish ? "outgoing" : "giden"}</p>
      </header>
      <ul className="request-list">
        {pendingIncomingRequests.length === 0 && <li className="empty-state">{isEnglish ? "No pending requests" : "Bekleyen istek yok"}</li>}
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
            <span>{isEnglish ? `Waiting approval from @${target}` : `@${target} onayı bekleniyor`}</span>
          </li>
        ))}
      </ul>
    </aside>
  )
}
