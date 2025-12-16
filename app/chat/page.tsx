'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthService } from '@/services/auth.service';
import { Sidebar } from '@/components/Sidebar';
import { ChatHeader } from '@/components/ChatHeader';
import { MessageList } from '@/components/MessageList';
import { Composer } from '@/components/Composer';
import { NewChatModal } from '@/components/modals/NewChatModal';
import { NewGroupModal } from '@/components/modals/NewGroupModal';
import { ParticipantsModal } from '@/components/modals/ParticipantsModal';
import { useChatController } from '@/hooks/useChatController';
import { Chat } from '@/types/chat';

export default function ChatPage() {
  const router = useRouter();

  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);

  const {
    loading,
    chats,
    selectedChat,
    messages,
    currentUserId,
    isConnected,

    editingMessageId,
    editingText,
    setEditingText,

    loadChats,
    loadMessages,

    sendCreate,
    sendDelete,
    startEdit,
    cancelEdit,
    saveEdit,

    wsDisconnect,

    addParticipant,
    removeParticipant,
  } = useChatController();

  useEffect(() => {
    if (!AuthService.isAuthenticated()) {
      router.push('/login');
    }
  }, [router]);

  const logout = () => {
    AuthService.logout();
    wsDisconnect();
    router.replace('/login');
  };

  const onCreatedChat = async (chat: Chat) => {
    await loadChats();
    await loadMessages(chat);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar
        chats={chats}
        selectedChatId={selectedChat?.id ?? null}
        isConnected={isConnected}
        onSelectChat={loadMessages}
        onLogout={logout}
        onOpenNewChat={() => setShowNewChatModal(true)}
        onOpenNewGroup={() => setShowNewGroupModal(true)}
      />

      <div className="flex-1 flex flex-col bg-white">
        {selectedChat ? (
          <>
            <ChatHeader chat={selectedChat} onOpenParticipants={() => setShowParticipantsModal(true)} />

            <MessageList
              messages={messages}
              currentUserId={currentUserId}
              editingMessageId={editingMessageId}
              editingText={editingText}
              onChangeEditingText={setEditingText}
              onStartEdit={startEdit}
              onCancelEdit={cancelEdit}
              onSaveEdit={saveEdit}
              onDelete={(id) => {
                if (!confirm('Are you sure you want to delete this message?')) return;
                sendDelete(id);
              }}
            />

            <Composer
              disabled={!selectedChat}
              onSend={async (text) => {
                if (!selectedChat) return;
                sendCreate(selectedChat.id, text);
              }}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 bg-white">
            Select a conversation to start messaging
          </div>
        )}
      </div>

      <NewChatModal
        open={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        onCreated={onCreatedChat}
      />

      <NewGroupModal
        open={showNewGroupModal}
        onClose={() => setShowNewGroupModal(false)}
        onCreated={onCreatedChat}
      />

      {selectedChat?.is_group && selectedChat && (
        <ParticipantsModal
          open={showParticipantsModal}
          chat={selectedChat}
          currentUserId={currentUserId}
          onClose={() => setShowParticipantsModal(false)}
          onRemove={(userId) => removeParticipant(selectedChat.id, userId)}
          onAdd={(user) => addParticipant(selectedChat.id, user)}
        />
      )}
    </div>
  );
}
