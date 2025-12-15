// types/chat.ts
export interface User {
  id: string;
  username: string;
  display_name?: string;
  email?: string;
  created_at?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_username?: string;
  body: string;
  created_at: string;
  updated_at?: string;
  read?: boolean;
}

export interface Chat {
  id: string;
  name?: string;
  title?: string;
  is_group: boolean;
  participants?: User[];
  last_message?: string;
  created_at: string;
  updated_at: string;
}

export type Conversation = Chat;

export interface WebSocketMessage {
  type: 'message.create' | 'message.edit' | 'message.delete' | 'typing' | 'read' | 'status' | 'pong';
  payload?: any;
}