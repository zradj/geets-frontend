export interface Message {
  id: string;
  body: string;            
  sender_id: string;
  conversation_id: string; 
  created_at: string;
  edited: boolean;
  deleted: boolean;
}


export interface Chat {
  id: string;
  name: string;
  is_group: boolean;
  participants: ChatMember[];
  last_message?: Message | string;  // Can be either
  created_at: string;
}

export interface ChatMember {
  user_id: string;
  username: string;
  is_admin?: boolean;
}