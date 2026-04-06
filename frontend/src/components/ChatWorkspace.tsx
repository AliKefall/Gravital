
import type { ChatWorkspaceProps } from "./chat/types"
import { useWorkspaceController } from "./chat/useWorkspaceController"
import { WorkspaceChatPanel } from "./chat/WorkspaceChatPanel"
import { WorkspaceSidebar } from "./chat/WorkspaceSidebar"


export const ChatWorkspace = (props: ChatWorkspaceProps) => {
  const { refs, state, actions } = useWorkspaceController(props)
  return (
    <main className="workspace compact-workspace">

      <WorkspaceSidebar
        username={state.username}
        rooms={state.rooms}
        activeRoom={state.activeRoom}
        activeDirectFriend={state.activeDirectFriend}
        newRoom={state.newRoom}
        newFriend={state.newFriend}
        friends={state.friends}
        selectedFriendForRoom={state.selectedFriendForRoom}
        status={state.status}
        unreadCountByRoom={state.unreadCountByRoom}
        pendingIncomingRequests={state.pendingIncomingRequests}
        pendingOutgoingRequests={state.pendingOutgoingRequests}
        onNewRoomChange={actions.setNewRoom}
        onCreateRoom={actions.handleCreateRoom}
        onSelectRoom={actions.handleSelectRoom}
        onNewFriendChange={actions.setNewFriend}
        onAddFriend={actions.handleAddFriend}
        onAcceptFriendRequest={actions.handleAcceptFriendRequest}
        onRejectFriendRequest={actions.handleRejectFriendRequest}
        onSelectDirectFriend={actions.handleSelectDirectFriend}
        onSelectFriendForRoom={actions.setSelectedFriendForRoom}
        onAddFriendToRoom={actions.handleAddFriendToRoom}
      />

      <WorkspaceChatPanel
        status={state.status}
        activeRoom={state.activeRoom}
        messageText={state.messageText}
        uploading={state.uploading}
        activeDirectFriend={state.activeDirectFriend}
        voiceConnected={state.voiceConnected}
        micMuted={state.micMuted}
        outputMuted={state.outputMuted}
        outputVolume={state.outputVolume}
        micVolume={state.micVolume}
        noiseGateDb={state.noiseGateDb}
        screenSharing={state.screenSharing}
        cameraSharing={state.cameraSharing}
        remoteScreens={state.remoteScreens}
        localPreviewScreen={state.localPreviewScreen}
        remoteAudios={state.remoteAudios}
        selectedScreenUser={state.selectedScreenUser}
        streamStatsByUser={state.streamStatsByUser}
        isJoiningVoice={state.isJoiningVoice}
        visibleMessages={state.visibleMessages}
        activeRoomMeta={state.activeRoomMeta}
        isActiveRoomOwner={state.isActiveRoomOwner}
        activeRoomScreenSharers={state.activeRoomScreenSharers}
        isCurrentUserSharingScreen={state.isCurrentUserSharingScreen}
        messageListRef={refs.messageListRef}
        onMessageTextChange={actions.setMessageText}
        onSendMessage={actions.handleSendRoomMessage}
        onToggleVoice={actions.handleToggleVoice}
        onToggleMic={actions.handleToggleMic}
        onToggleOutput={actions.handleToggleOutput}
        onToggleScreenShare={actions.handleToggleScreenShare}
        onToggleCameraShare={actions.handleToggleCameraShare}
        onOutputVolumeChange={actions.handleOutputVolumeChange}
        onMicVolumeChange={actions.handleMicVolumeChange}
        onNoiseGateDbChange={actions.setNoiseGateDb}
        onLeaveRoom={actions.handleLeaveRoom}
        onCloseRoom={actions.handleCloseRoom}
        onUploadAttachment={actions.handleUploadAttachment}
        onSelectedScreenUser={actions.setSelectedScreenUser}
        onLogout={actions.handleLogout}
      />
    </main>
  )
}
