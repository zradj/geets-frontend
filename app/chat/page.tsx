'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthService } from '@/services/auth.service';
import { ChatService } from '@/services/chat.service';
import { Chat, Message } from '@/types/chat';
import toast from 'react-hot-toast';
import 'react-toastify/dist/ReactToastify.css';

export default function ChatPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [groupTitle, setGroupTitle] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  
  // New conversation modal
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!AuthService.isAuthenticated()) {
      router.push('/login');
      return;
    }
    loadChats();
  }, [router]);

  const loadChats = async () => {
    try {
      const data = await ChatService.getAllChats();
      setChats(data);
    } catch (error) {
      console.error('Failed to load chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (chat: Chat) => {
    try {
      const data = await ChatService.getMessages(chat.id, chat.is_group);
      setMessages(data);
      setSelectedChat(chat);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat || sendingMessage) return;

    setSendingMessage(true);
    try {
      const message = await ChatService.sendMessage(
        selectedChat.id,
        newMessage,
        selectedChat.is_group
      );
      setMessages([...messages, message]);
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleSearchUsers = async () => {
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    try {
      const results = await ChatService.searchUsers(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error('Failed to search users:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleCreateConversation = async (userId: string) => {
    try {
      const newChat = await ChatService.createConversation(userId);
      setChats([newChat, ...chats]);
      setShowNewConversationModal(false);
      setSearchQuery('');
      setSearchResults([]);
      loadMessages(newChat);
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message)
        console.error('Failed to create conversation:', error);
      }
    }
  };

  const handleCreateGroup = async (title: string, participantIds: string[]) => {
    try {
      const newChat = await ChatService.createGroup(title, participantIds);
      setChats([newChat, ...chats]);
      setShowNewGroupModal(false);
      setSearchQuery('');
      setSearchResults([]);
      loadMessages(newChat);
    } catch (error) {
      console.error('Failed to create group:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
  <div className="flex h-screen bg-gray-50 text-black">
    {/* Sidebar */}
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Geets</h1>
        <button
          onClick={() => setShowNewConversationModal(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
        >
          + Conversation
        </button>
        <button
          onClick={() => setShowNewGroupModal(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
        >
          + Group
        </button>
      </div>

      <div className="overflow-y-auto flex-1">
        {chats.length === 0 ? (
          <p className="p-4 text-gray-500 text-center">No conversations yet</p>
        ) : (
          chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => loadMessages(chat)}
              className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-100 ${
                selectedChat?.id === chat.id ? 'bg-indigo-50' : ''
              }`}
            >
              <div className="font-semibold text-gray-800">{chat.title}</div>
            </div>
          ))
        )}
      </div>
    </div>

    {/* Main Chat Area */}
    <div className="flex-1 flex flex-col bg-white">
      {selectedChat ? (
        <>
          <div className="border-b border-gray-200 p-4 bg-gray-50">
            <h2 className="text-xl font-semibold text-gray-800">
              {selectedChat.title}
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
            {messages.map((message) => (
              <div key={message.id} className="flex flex-col">
                <div className="bg-gray-100 rounded-lg p-3 shadow-sm max-w-md border border-gray-200">
                  <p className="text-gray-800">{message.body}</p>
                  <span className="text-xs text-gray-500 mt-1">
                    {new Date(message.created_at).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-200 p-4 bg-gray-50">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-800"
                disabled={sendingMessage}
              />
              <button
                type="submit"
                disabled={sendingMessage || !newMessage.trim()}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400"
              >
                Send
              </button>
            </form>
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400 bg-white">
          Select a conversation to start messaging
        </div>
      )}
    </div>

    {/* New Conversation Modal */}
    {showNewConversationModal && (
      <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-96 shadow-lg">
          <h2 className="text-xl font-bold mb-4 text-gray-800">New Conversation</h2>

          <div className="mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search username..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800"
              onKeyPress={(e) => e.key === 'Enter' && handleSearchUsers()}
            />
            <button
              onClick={handleSearchUsers}
              disabled={searching || !searchQuery.trim()}
              className="mt-2 w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400"
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto">
            {searchResults && searchResults.length > 0 ? (
              searchResults.map((user) => (
                <div
                  key={user.id}
                  onClick={() => handleCreateConversation(user.id)}
                  className="p-3 hover:bg-gray-100 cursor-pointer rounded-lg"
                > 
                  <div className="font-semibold text-gray-800">{user.username}</div>
                </div>
              ))
            ) : searchResults === null ? null : (
              <p className="text-gray-500 text-center p-4">No users found</p>
            )}
          </div>

          <button
            onClick={() => {
              setShowNewConversationModal(false);
              setSearchQuery('');
              setSearchResults([]);
            }}
            className="mt-4 w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-700"
          >
            Cancel
          </button>
        </div>
      </div>
    )}
    {showNewGroupModal && (
      <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-96 shadow-lg">
          <h2 className="text-xl font-bold mb-4 text-gray-800">New Group</h2>

          <div className="mb-4">
            <input
              type="text"
              value={groupTitle}
              onChange={(e) => setGroupTitle(e.target.value)}
              placeholder="Group title"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800"
            />
          </div>

          <div className="mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search username..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800"
              onKeyPress={(e) => e.key === 'Enter' && handleSearchUsers()}
            />
            <button
              onClick={handleSearchUsers}
              disabled={searching || !searchQuery.trim()}
              className="mt-2 w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400"
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto">
            {searchResults && searchResults.length > 0 ? (
              searchResults.map((user) => (
                <div
                  key={user.id}
                  onClick={() => handleCreateGroup(groupTitle, [user.id])}
                  className="p-3 hover:bg-gray-100 cursor-pointer rounded-lg"
                > 
                  <div className="font-semibold text-gray-800">{user.username}</div>
                </div>
              ))
            ) : searchResults === null ? null : (
              <p className="text-gray-500 text-center p-4">No users found</p>
            )}
          </div>

          <button
            onClick={() => {
              setShowNewGroupModal(false);
              setSearchQuery('');
              setSearchResults([]);
            }}
            className="mt-4 w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-700"
          >
            Cancel
          </button>
        </div>
      </div>
    )}
  </div>
);

}