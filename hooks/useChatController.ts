'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChatService } from '@/services/chat.service';
import { Chat, Message, ReceiptStatus, User } from '@/types/chat';
import { useWebSocket, WsEventType } from '@/hooks/useWebSocket';
import { useCurrentUserId } from '@/hooks/useCurrentUserId';

function pickMessageId(payload: any): string | null {
  return String(payload?.message_id ?? payload?.id ?? payload?.messageId ?? '');
}

function safeIso(s: any) {
  return typeof s === 'string' && s.length ? s : new Date().toISOString();
}

function wsCreateToMessage(payload: any): Message {
  return {
    id: String(payload?.id ?? Date.now().toString()),
    conversation_id: String(payload?.conversation_id),
    sender_id: String(payload?.sender_id),
    sender_username: payload?.sender_username,
    body: String(payload?.body ?? ''),
    created_at: safeIso(payload?.created_at),
    updated_at: payload?.updated_at ? safeIso(payload?.updated_at) : undefined,
  };
}

export function useChatController() {
  const currentUserId = useCurrentUserId();

  const [loading, setLoading] = useState(true);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const selectedChatRef = useRef<Chat | null>(null);
  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  const loadChats = useCallback(async () => {
    try {
      const data = await ChatService.getAllChats();
      setChats(data);
    } catch (e) {
      console.error('Failed to load chats:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (chat: Chat) => {
    try {
      const data = await ChatService.getMessages(chat.id, chat.is_group);

      let nextChat: Chat = chat;
      if (chat.is_group) {
        const participants = await ChatService.getGroupParticipants(chat.id);
        nextChat = { ...chat, participants };
      }

      setSelectedChat(nextChat);
      setMessages(data);
      setEditingMessageId(null);
      setEditingText('');
    } catch (e) {
      console.error('Failed to load messages:', e);
    }
  }, []);

  // WS handler
  const onWsEvent = useCallback(
    (type: WsEventType, payload: any) => {
      const selected = selectedChatRef.current;
      const selectedId = selected ? String(selected.id) : null;

      if (type === 'message.create') {
        const msg = wsCreateToMessage(payload);

        if (selectedId && msg.conversation_id === selectedId) {
          setMessages((prev) => [...prev, msg]);
        }
        loadChats();
        return;
      }

      if (type === 'message.edit') {
        const id = pickMessageId(payload);
        if (!id) return;

        const newBody = String(payload?.body ?? payload?.new_body ?? '');
        const updatedAt = safeIso(payload?.updated_at);

        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, body: newBody, updated_at: updatedAt } : m))
        );
        return;
      }

      if (type === 'message.delete') {
        const id = pickMessageId(payload);
        if (!id) return;
        setMessages((prev) => prev.filter((m) => m.id !== id));
        return;
      }

      if (type === 'message.delivered' || type === 'message.seen') {
        const id = pickMessageId(payload);
        if (!id) return;

        const status: ReceiptStatus = type === 'message.seen' ? 'SEEN' : 'DELIVERED';
        const deliveredAt = payload?.delivered_at ?? payload?.timestamp ?? null;
        const seenAt = payload?.seen_at ?? payload?.timestamp ?? null;

        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== id) return m;

            // статус не должен откатываться назад
            const nextStatus =
              m.status === 'SEEN'
                ? 'SEEN'
                : status === 'SEEN'
                ? 'SEEN'
                : m.status === 'DELIVERED'
                ? 'DELIVERED'
                : status;

            return {
              ...m,
              status: nextStatus,
              delivered_at: deliveredAt ?? m.delivered_at ?? null,
              seen_at: seenAt ?? m.seen_at ?? null,
            };
          })
        );
        return;
      }
    },
    [loadChats]
  );

  const { isConnected, sendMessage: sendWsMessage, disconnect: wsDisconnect } = useWebSocket(
    (type, payload) => onWsEvent(type, payload),
    { debug: false }
  );

  // initial load
  useEffect(() => {
    loadChats();
  }, [loadChats]);

  const sendCreate = useCallback(
    (conversationId: string, body: string) => {
      sendWsMessage('message.create', { conversation_id: conversationId, body });
    },
    [sendWsMessage]
  );

  const sendEdit = useCallback(
    (messageId: string, newBody: string) => {
      sendWsMessage('message.edit', { id: messageId, new_body: newBody });
    },
    [sendWsMessage]
  );

  const sendDelete = useCallback(
    (messageId: string) => {
      sendWsMessage('message.delete', { id: messageId });
    },
    [sendWsMessage]
  );

  const startEdit = useCallback((m: Message) => {
    setEditingMessageId(m.id);
    setEditingText(m.body);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setEditingText('');
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingMessageId) return;
    const text = editingText.trim();
    if (!text) return;

    sendEdit(editingMessageId, text);
    setEditingMessageId(null);
    setEditingText('');
  }, [editingMessageId, editingText, sendEdit]);

  // group actions
  const removeParticipant = useCallback(async (groupId: string, userId: string) => {
    await ChatService.removeGroupParticipant(groupId, userId);

    setSelectedChat((prev) => {
      if (!prev || prev.id !== groupId) return prev;
      return { ...prev, participants: prev.participants?.filter((p) => p.id !== userId) };
    });
  }, []);

  const addParticipant = useCallback(async (groupId: string, user: User) => {
    await ChatService.addGroupParticipant(groupId, user.id);

    setSelectedChat((prev) => {
      if (!prev || prev.id !== groupId) return prev;
      const exists = prev.participants?.some((p) => p.id === user.id);
      if (exists) return prev;
      return { ...prev, participants: [...(prev.participants ?? []), user] };
    });
  }, []);

  return {
    // state
    loading,
    chats,
    selectedChat,
    messages,
    currentUserId,
    isConnected,

    editingMessageId,
    editingText,
    setEditingText,

    // actions
    loadChats,
    loadMessages,
    setSelectedChat,
    setMessages,

    sendCreate,
    sendDelete,
    startEdit,
    cancelEdit,
    saveEdit,

    wsDisconnect,

    addParticipant,
    removeParticipant,
  };
}
