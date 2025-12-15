// services/chat.service.ts

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export class ChatService {
  private static getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    };
  }

  static async getAllChats() {
    const response = await fetch(`${API_URL}/api/conversations`, {
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch chats');
    return response.json();
  }

  static async getMessages(chatId: string, isGroup: boolean = false, limit: number = 50) {
    const endpoint = isGroup 
      ? `/api/groups/${chatId}/messages`
      : `/api/conversations/${chatId}/messages`;
    
    const response = await fetch(`${API_URL}${endpoint}?limit=${limit}`, {
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch messages');
    return response.json();
  }

// NEW - Fixed:
static async searchUsers(query: string) {
  const response = await fetch(
    `${API_URL}/api/users/search?username=${encodeURIComponent(query)}`,  // ✅ sending 'username'
    {
      headers: this.getAuthHeaders(),
    }
  );
  if (!response.ok) throw new Error('Failed to search users');
  return response.json();
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
      const errorJson = await response.json();
      console.error('Create conversation error:', JSON.stringify(errorJson));
      throw new Error(`Failed to create conversation: ${errorJson['detail']}`);
    }

    return response.json();
  }


  static async createGroup(name: string, userIds: string[]) {
    const response = await fetch(`${API_URL}/api/groups`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ name, user_ids: userIds }),
    });
    if (!response.ok) throw new Error('Failed to create group');
    return response.json();
  }

  static async sendMessage(conversationId: string, body: string, isGroup: boolean = false) {
    const endpoint = isGroup
      ? `/api/groups/${conversationId}/messages`
      : `/api/conversations/${conversationId}/messages`;

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ body }),
    });
    if (!response.ok) throw new Error('Failed to send message');
    return response.json();
  }

  // ADD THIS METHOD:
  static async getCurrentUser() {
    const response = await fetch(`${API_URL}/api/users/me`, {
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch user info');
    return response.json();
  }
}