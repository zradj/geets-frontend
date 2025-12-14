export interface Message {
  id: string;
  content: string;
  sender_id: string;
  chat_id: string;
  created_at: string;
  is_read: boolean;
}

export interface Chat {
  id: string;
  name?: string;
  is_group: boolean;
  participants: string[];
  last_message?: Message;
  created_at: string;
}

export interface ChatMember {
  user_id: string;
  username: string;
  is_admin?: boolean;
}