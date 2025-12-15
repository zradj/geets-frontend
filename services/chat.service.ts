import { Chat, Message } from '@/types/chat';
import { AuthService } from './auth.service';

const API_BASE_URL = 'http://localhost:8000';

export class ChatService {
  // Fetch all user conversations and groups
  static async getAllChats(): Promise<Chat[]> {
    const token = AuthService.getToken();
    if (!token) throw new Error('Not authenticated');

    const [conversations, groups] = await Promise.all([
      fetch(`${API_BASE_URL}/api/conversations`, {
        headers: { 'Authorization': `Bearer ${token}` },
      }).then(r => (r.ok ? r.json() : [])),

      fetch(`${API_BASE_URL}/api/groups`, {
        headers: { 'Authorization': `Bearer ${token}` },
      }).then(r => (r.ok ? r.json() : [])),
    ]);

    return [...conversations, ...groups];
  }

  // Fetch all messages for a conversation or group
  // Fetch all messages for a conversation or group
static async getMessages(chatId: string, isGroup: boolean): Promise<Message[]> {
  const token = AuthService.getToken();
  if (!token) throw new Error('Not authenticated');

  const endpoint = isGroup
    ? `/api/groups/${chatId}/messages`
    : `/api/conversations/${chatId}/messages`;

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to fetch messages:', error);
    throw new Error('Failed to fetch messages');
  }

  const data = await response.json();

  return data.map((msg: any) => ({
    id: msg.id,
    body: msg.body,                       // ✅ backend field
    sender_id: msg.sender_id,
    conversation_id: msg.conversation_id, // ✅ backend field
    created_at: msg.created_at,
    edited: msg.edited ?? false,
    deleted: msg.deleted ?? false,
  })) as Message[];
}


  // Send a message to a conversation or group
static async sendMessage(chatId: string, body: string, isGroup: boolean): Promise<Message> {
  const token = AuthService.getToken();
  if (!token) throw new Error('Not authenticated');

  const endpoint = isGroup
    ? `/api/groups/${chatId}/messages`
    : `/api/conversations/${chatId}/messages`;

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body }), 
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to send message:', error);
    throw new Error('Failed to send message');
  }

  const message = await response.json();

  
  return {
    id: message.id,
    body: message.body,
    sender_id: message.sender_id,
    conversation_id: message.conversation_id,
    created_at: message.created_at,
    edited: message.edited ?? false,
    deleted: message.deleted ?? false,
  } as Message;
}


  // src/services/chat.service.ts
static async searchUsers(username: string): Promise<any[]> {
  const token = AuthService.getToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(
    `http://localhost:8000/api/users/search?username=${encodeURIComponent(username)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (res.status === 404) {
    // exact username not found -> return empty list instead of throwing
    return [];
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    console.error('Search error:', res.status, txt);
    throw new Error(`Failed to search users: ${res.status}`);
  }

  const user = await res.json();
  return user ? [user] : [];
}


  static async createConversation(participantId: string): Promise<Chat> {
    const token = AuthService.getToken();
    if (!token) throw new Error('Not authenticated');

    console.log('Creating conversation with participant:', participantId);

    const response = await fetch(`${API_BASE_URL}/api/conversations/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ other_id: participantId }),
    });

    console.log('Create conversation response:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Create conversation error:', errorText);
      throw new Error(`Failed to create conversation: ${response.status} ${errorText}`);
    }

    return response.json();
  }
}
/////
