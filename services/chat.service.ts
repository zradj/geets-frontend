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

    return response.json();
  }

  // Send a message to a conversation or group
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
      const error = await response.text();
      console.error('Failed to send message:', error);
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

    console.log('Search response status:', response.status);
    console.log('Search response ok:', response.ok);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Search error:', errorData);
      throw new Error(`Failed to search users: ${response.status}`);
    }

    const user = await response.json();
    console.log('Found user:', user);

    // Backend returns a single user, so wrap it in an array
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
////
