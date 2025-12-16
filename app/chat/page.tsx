'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AuthService } from '@/services/auth.service';
import { ChatService } from '@/services/chat.service';
import { Chat, Message } from '@/types/chat';
import { useWebSocket } from '@/hooks/useWebSocket';
import { jwtDecode } from "jwt-decode";
import { FaSignOutAlt, FaTimes } from 'react-icons/fa';

interface JwtPayload {
  sub: string;
  name: string;
  exp: number;
}

export default function ChatPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  
  // New conversation modal
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  
  // Group creation modal
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [groupSearchResults, setGroupSearchResults] = useState<any[]>([]);
  const [searchingGroupUsers, setSearchingGroupUsers] = useState(false);
  
  const [currentUserId, setCurrentUserId] = useState<string>('');


  const selectedChatRef = useRef(selectedChat);
  useEffect(() => { selectedChatRef.current = selectedChat; }, [selectedChat]);

  useEffect(() => {
    if (!AuthService.isAuthenticated()) {
      router.push('/login');
      return;
    }
    loadChats();
  }, [router]);

  useEffect(() => {
    const token = AuthService.getToken();
    if (token) {
      const decodedToken = jwtDecode<JwtPayload>(token);
      setCurrentUserId(String(decodedToken.sub))
    }
  }, []);

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

  const handleWs = useCallback((message: Message, type: string) => {
    const selected = selectedChatRef.current;
    const selected_id = String(selected?.id)
    if (type === 'message.create') {
      if (selected && message.conversation_id === selected_id) {
        setMessages((prev) => {
          console.log('messages prev length', prev.length); 
          const next = [...prev, message];
          console.log('messages next length', next.length, 'appended id=', message.id);
          return next;
        });
      }
      loadChats();
    } else if (type === 'message.edit') {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === message.id ? { ...msg, body: message.body, updated_at: message.updated_at } : msg
        )
      );
    } else if (type === 'message.delete') {
      setMessages((prev) => prev.filter((msg) => msg.id !== message.id));
    }
  }, [loadChats]);

  const { isConnected, sendMessage: sendWsMessage, disconnect: wsDisconnect } = useWebSocket(handleWs);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages.length]);


  const loadMessages = async (chat: Chat) => {
    try {
      const data = await ChatService.getMessages(chat.id, chat.is_group);
      setMessages(data);
      setSelectedChat(chat);
      setEditingMessageId(null);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat || sendingMessage) return;

    setSendingMessage(true);
    try {
      sendWsMessage('message.create', {
        conversation_id: selectedChat.id,
        body: newMessage,
      });
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleStartEdit = (message: Message) => {
    setEditingMessageId(message.id);
    setEditingText(message.body);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText('');
  };

  const handleSaveEdit = async (messageId: string) => {
    if (!editingText.trim() || !selectedChat) return;

    try {
      sendWsMessage('message.edit', {
        id: messageId,
        new_body: editingText,
      });
      setEditingMessageId(null);
      setEditingText('');
    } catch (error) {
      console.error('Failed to edit message:', error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!selectedChat) return;
    if (!confirm('Are you sure you want to delete this message?')) return;

    try {
      sendWsMessage('message.delete', {
        id: messageId,
      });
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  const handleSearchUsers = async () => {
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    try {
      const results = await ChatService.searchUsers(searchQuery);
      
      // Backend returns single object, convert to array
      const resultsArray = Array.isArray(results) ? results : [results];
      setSearchResults(resultsArray);
    } catch (error) {
      console.error('Failed to search users:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleCreateConversation = async (userId: string) => {
    try {
      const newChat = await ChatService.createConversation(userId);
      setShowNewChatModal(false);
      setSearchQuery('');
      setSearchResults([]);
      await loadChats();
      loadMessages(newChat);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const handleSearchGroupUsers = async () => {
    if (!groupSearchQuery.trim()) return;
    
    setSearchingGroupUsers(true);
    try {
      const result = await ChatService.searchUsers(groupSearchQuery);
      setGroupSearchResults([result]);
    } catch (error) {
      console.error('Failed to search users:', error);
      setGroupSearchResults([]);
    } finally {
      setSearchingGroupUsers(false);
    }
  };

  const handleToggleUserSelection = (user: any) => {
    if (selectedUsers.find(u => u.id === user.id)) {
      setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) {
      alert('Please enter a group name and select at least one member');
      return;
    }

    try {
      const userIds = selectedUsers.map(u => u.id);
      const newGroup = await ChatService.createGroup(groupName, userIds);
      setShowNewGroupModal(false);
      setGroupName('');
      setSelectedUsers([]);
      setGroupSearchQuery('');
      setGroupSearchResults([]);
      await loadChats();
      loadMessages(newGroup);
    } catch (error) {
      console.error('Failed to create group:', error);
      alert('Failed to create group. Please try again.');
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
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between gap-2">
            <h1 className="text-2xl font-bold text-gray-800 mb-3">Geets</h1>
            <button
              onClick={() => { AuthService.logout(); wsDisconnect(); router.replace('/login'); }}
              className="mb-2 px-3 bg-red-700 text-white rounded-lg hover:bg-red-900 text-sm font-medium cursor-pointer"
            >
              <FaSignOutAlt />
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowNewChatModal(true)}
              className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium cursor-pointer"
            >
              + Chat
            </button>
            <button
              onClick={() => setShowNewGroupModal(true)}
              className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium cursor-pointer"
            >
              + Group
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {chats.length === 0 ? (
            <p className="p-4 text-gray-500 text-center">No conversations yet</p>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => loadMessages(chat)}
                className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-100 transition ${
                  selectedChat?.id === chat.id ? 'bg-indigo-50' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  {chat.is_group && <span className="text-lg">👥</span>}
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800">
                      {chat.name || chat.title || 'Unnamed Chat'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {chat.is_group ? 'Group' : 'Direct Message'}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-3 border-t border-gray-200 text-xs text-gray-500">
          {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
        {selectedChat ? (
          <>
            <div className="border-b border-gray-200 p-4 bg-gray-50">
              <div className="flex items-center gap-2">
                {selectedChat.is_group && <span className="text-2xl">👥</span>}
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">
                    {selectedChat.name || selectedChat.title || 'Chat'}
                  </h2>
                  <div className="text-sm text-gray-500">
                    {selectedChat.is_group ? (
                      <span>
                        Group • {selectedChat.participants?.length || 0} members
                      </span>
                    ) : (
                      <span>Direct Message</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
              {messages.map((message: Message) => {
                console.log('updating')
                const isMyMessage = String(message.sender_id) === currentUserId;
                const isEditing = editingMessageId === message.id;

                return (
                  <div key={message.id} className={`flex flex-col ${isMyMessage ? 'items-end' : 'items-start'}`}>
                    <div className={`group relative max-w-md ${isMyMessage ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-900'} rounded-lg p-3 shadow-sm border ${isMyMessage ? 'border-indigo-700' : 'border-gray-200'}`}>

                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(message.id);
                              else if (e.key === 'Escape') handleCancelEdit();
                            }}
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button onClick={() => handleSaveEdit(message.id)} className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">Save</button>
                            <button onClick={handleCancelEdit} className="px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 cursor-pointer">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {isMyMessage ? '' : <><p className='text-black-600 font-bold'>{message.sender_username}</p><hr /></>}
                          <p className={`${isMyMessage ? 'text-white' : 'text-black-600'}`}>{message.body}</p>
                          <div className="text-xs opacity-70 mt-1 flex items-center gap-1">
                            <span>{new Date(message.created_at + 'Z').toLocaleTimeString()}</span>
                            {message.updated_at && message.updated_at !== message.created_at && (
                              <span className="italic">(edited)</span>
                            )}
                          </div>

                          {isMyMessage && (
                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                              <button onClick={() => handleStartEdit(message)} className="p-1 bg-white text-gray-600 rounded hover:bg-gray-100 text-xs" title="Edit">✏️</button>
                              <button onClick={() => handleDeleteMessage(message.id)} className="p-1 bg-white text-red-600 rounded hover:bg-red-50 text-xs" title="Delete">🗑️</button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef}></div>
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
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 cursor-pointer"
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

      {/* New Direct Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-lg">
            <h2 className="text-xl font-bold mb-4 text-gray-800">New Direct Chat</h2>

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
              {searchResults.length > 0 ? (
                searchResults.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => handleCreateConversation(user.id)}
                    className="p-3 hover:bg-gray-100 cursor-pointer rounded-lg cursor-pointer"
                  >
                    <div className="font-semibold text-gray-800">{user.username}</div>
                    {user.display_name && (
                      <div className="text-sm text-gray-500">{user.display_name}</div>
                    )}
                  </div>
                ))
              ) : searchQuery && !searching ? (
                <p className="text-gray-500 text-center p-4">No users found</p>
              ) : null}
            </div>

            <button
              onClick={() => {
                setShowNewChatModal(false);
                setSearchQuery('');
                setSearchResults([]);
              }}
              className="mt-4 w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-700 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* New Group Modal */}
      {showNewGroupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[500px] shadow-lg max-h-[80vh] flex flex-col">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Create Group</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Group Name</label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Enter group name..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-800"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Add Members</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={groupSearchQuery}
                  onChange={(e) => setGroupSearchQuery(e.target.value)}
                  placeholder="Search username..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-800"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearchGroupUsers()}
                />
                <button
                  onClick={handleSearchGroupUsers}
                  disabled={searchingGroupUsers || !groupSearchQuery.trim()}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 cursor-pointer"
                >
                  Search
                </button>
              </div>
            </div>

            {selectedUsers.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selected Members ({selectedUsers.length})
                </label>
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-1 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm"
                    >
                      <span>{user.username}</span>
                      <button
                        onClick={() => handleToggleUserSelection(user)}
                        className="text-green-600 hover:text-green-800 font-bold"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto mb-4 min-h-[150px] max-h-[250px]">
              {groupSearchResults.length > 0 ? (
                <div className="border border-gray-200 rounded-lg divide-y">
                  {groupSearchResults.map((user) => {
                    const isSelected = selectedUsers.find(u => u.id === user.id);
                    return (
                      <div
                        key={user.id}
                        onClick={() => handleToggleUserSelection(user)}
                        className={`p-3 cursor-pointer hover:bg-gray-50 ${
                          isSelected ? 'bg-green-50' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-gray-800">{user.username}</div>
                            {user.display_name && (
                              <div className="text-sm text-gray-500">{user.display_name}</div>
                            )}
                          </div>
                          {isSelected && <span className="text-green-600">✓</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (groupSearchQuery && !searchingGroupUsers ? (
                <p className="text-gray-500 text-center p-4">No users found</p>
              ) : (
                <p className="text-gray-400 text-center p-4">Search for users to add to group</p>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCreateGroup}
                disabled={!groupName.trim() || selectedUsers.length === 0}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
              >
                Create Group
              </button>
              <button
                onClick={() => {
                  setShowNewGroupModal(false);
                  setGroupName('');
                  setSelectedUsers([]);
                  setGroupSearchQuery('');
                  setGroupSearchResults([]);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-700 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}