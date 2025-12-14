import { Chat, Message } from '@/types/chat';
import { AuthService } from './auth.service';

const API_BASE_URL = 'http://localhost:8000';

export class ChatService {
  static async getAllChats(): Promise<Chat[]> {
    const token = AuthService.getToken();
    if (!token) throw new Error('Not authenticated');

    const [conversations, groups] = await Promise.all([
      fetch(`${API_BASE_URL}/api/conversations`, {
        headers: { 'Authorization': `Bearer ${token}` },
      }).then(r => r.ok ? r.json() : []),
      
      fetch(`${API_BASE_URL}/api/groups`, {
        headers: { 'Authorization': `Bearer ${token}` },
      }).then(r => r.ok ? r.json() : []),
    ]);

    return [...conversations, ...groups];
  }

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
      throw new Error('Failed to fetch messages');
    }

    return response.json();
  }

  static async sendMessage(chatId: string, content: string, isGroup: boolean): Promise<Message> {
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
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      throw new Error('Failed to send message');
    }

    return response.json();
  }
  // Search for users by username
static async searchUsers(username: string): Promise<any[]> {
  const token = AuthService.getToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(
    `${API_BASE_URL}/api/users/search?username=${username}`,
    {
      headers: { 'Authorization': `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to search users');
  }

  return response.json();
}

static async createConversation(participantId: string): Promise<Chat> {
  const token = AuthService.getToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE_URL}/api/conversations/create`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ participant_id: participantId }),
  });

  if (!response.ok) {
    throw new Error('Failed to create conversation');
  }

  return response.json();
}
}