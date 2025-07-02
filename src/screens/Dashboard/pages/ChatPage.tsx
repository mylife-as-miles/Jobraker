import React, { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { 
  Send, 
  Search, 
  MoreVertical, 
  Phone, 
  Video, 
  Paperclip,
  Smile,
  Plus,
  MessageCircle,
  Users,
  Settings
} from "lucide-react";
import { motion } from "framer-motion";

interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  timestamp: string;
  isOwn: boolean;
  avatar?: string;
}

interface ChatConversation {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
  avatar: string;
  online: boolean;
}

export const ChatPage = (): JSX.Element => {
  const [selectedChat, setSelectedChat] = useState<string>("1");
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const conversations: ChatConversation[] = [
    {
      id: "1",
      name: "HR Team - Google",
      lastMessage: "Thank you for your application. We'll be in touch soon.",
      timestamp: "2 min ago",
      unread: 2,
      avatar: "G",
      online: true
    },
    {
      id: "2",
      name: "Recruiter - Microsoft",
      lastMessage: "Can we schedule a call for tomorrow?",
      timestamp: "1 hour ago",
      unread: 0,
      avatar: "M",
      online: true
    },
    {
      id: "3",
      name: "JobRaker Support",
      lastMessage: "Your premium subscription is about to expire.",
      timestamp: "3 hours ago",
      unread: 1,
      avatar: "JR",
      online: false
    },
    {
      id: "4",
      name: "Career Coach",
      lastMessage: "I've reviewed your resume. Here are my suggestions...",
      timestamp: "Yesterday",
      unread: 0,
      avatar: "CC",
      online: false
    }
  ];

  const messages: ChatMessage[] = [
    {
      id: "1",
      sender: "HR Team",
      message: "Hello! Thank you for applying to the Senior Software Engineer position at Google.",
      timestamp: "10:30 AM",
      isOwn: false
    },
    {
      id: "2",
      sender: "You",
      message: "Thank you for reaching out! I'm very excited about this opportunity.",
      timestamp: "10:32 AM",
      isOwn: true
    },
    {
      id: "3",
      sender: "HR Team",
      message: "We've reviewed your application and would like to schedule a technical interview. Are you available next week?",
      timestamp: "10:35 AM",
      isOwn: false
    },
    {
      id: "4",
      sender: "You",
      message: "Yes, I'm available next week. What days work best for your team?",
      timestamp: "10:37 AM",
      isOwn: true
    },
    {
      id: "5",
      sender: "HR Team",
      message: "Perfect! How about Tuesday at 2 PM PST? The interview will be conducted via Google Meet and should take about 1 hour.",
      timestamp: "10:40 AM",
      isOwn: false
    }
  ];

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      // Add message logic here
      setNewMessage("");
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col lg:flex-row">
      {/* Chat List Sidebar */}
      <div className={`${sidebarOpen ? 'flex' : 'hidden'} lg:flex flex-col w-full lg:w-80 xl:w-96 bg-[#0a0a0a] border-r border-[#ffffff1a] ${!sidebarOpen ? 'lg:w-0' : ''}`}>
        {/* Chat Header */}
        <div className="p-3 sm:p-4 border-b border-[#ffffff1a]">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-white">Messages</h2>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" className="text-[#ffffff80] hover:text-white p-1 sm:p-2">
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="lg:hidden text-[#ffffff80] hover:text-white p-1 sm:p-2"
                onClick={() => setSidebarOpen(false)}
              >
                <MoreVertical className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </div>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-[#ffffff60]" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 sm:pl-10 bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60] focus:border-[#1dff00] text-sm"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map((conversation) => (
            <motion.div
              key={conversation.id}
              onClick={() => {
                setSelectedChat(conversation.id);
                setSidebarOpen(false);
              }}
              className={`p-3 sm:p-4 border-b border-[#ffffff0d] cursor-pointer transition-all duration-200 ${
                selectedChat === conversation.id
                  ? "bg-[#1dff0015] border-r-2 border-r-[#1dff00]"
                  : "hover:bg-[#ffffff0a]"
              }`}
              whileHover={{ x: 4 }}
            >
              <div className="flex items-start space-x-2 sm:space-x-3">
                <div className="relative flex-shrink-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-full flex items-center justify-center text-black font-bold text-xs sm:text-sm">
                    {conversation.avatar}
                  </div>
                  {conversation.online && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 lg:w-4 lg:h-4 bg-[#1dff00] rounded-full border-2 border-[#0a0a0a]"></div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-white font-medium truncate text-sm sm:text-base">{conversation.name}</h3>
                    <span className="text-xs text-[#ffffff60] flex-shrink-0">{conversation.timestamp}</span>
                  </div>
                  <p className="text-xs sm:text-sm text-[#ffffff80] truncate">{conversation.lastMessage}</p>
                </div>
                
                {conversation.unread > 0 && (
                  <div className="w-4 h-4 sm:w-5 sm:h-5 bg-[#1dff00] rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs text-black font-bold">{conversation.unread}</span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Chat Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="p-3 sm:p-4 border-b border-[#ffffff1a] bg-[#0a0a0a]">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="lg:hidden text-white hover:bg-[#ffffff1a] p-1 sm:p-2"
                    onClick={() => setSidebarOpen(true)}
                  >
                    <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Button>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-full flex items-center justify-center text-black font-bold text-xs sm:text-sm flex-shrink-0">
                    G
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-white font-medium text-sm sm:text-base truncate">HR Team - Google</h3>
                    <p className="text-xs sm:text-sm text-[#1dff00]">Online</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
                  <Button variant="ghost" size="sm" className="text-[#ffffff80] hover:text-white p-1 sm:p-2">
                    <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-[#ffffff80] hover:text-white p-1 sm:p-2">
                    <Video className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-[#ffffff80] hover:text-white p-1 sm:p-2">
                    <MoreVertical className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 bg-black">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.isOwn ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[85%] sm:max-w-xs lg:max-w-md ${message.isOwn ? "order-2" : "order-1"}`}>
                    <div
                      className={`p-2 sm:p-3 rounded-2xl ${
                        message.isOwn
                          ? "bg-[#1dff00] text-black"
                          : "bg-[#ffffff1a] text-white border border-[#ffffff33]"
                      }`}
                    >
                      <p className="text-xs sm:text-sm">{message.message}</p>
                    </div>
                    <p className={`text-xs text-[#ffffff60] mt-1 ${message.isOwn ? "text-right" : "text-left"}`}>
                      {message.timestamp}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Message Input */}
            <div className="p-3 sm:p-4 border-t border-[#ffffff1a] bg-[#0a0a0a]">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <Button variant="ghost" size="sm" className="text-[#ffffff80] hover:text-white p-1 sm:p-2 flex-shrink-0">
                  <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
                
                <div className="flex-1 relative">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                    className="bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60] focus:border-[#1dff00] pr-10 sm:pr-12 text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 sm:right-2 top-1/2 transform -translate-y-1/2 text-[#ffffff80] hover:text-white p-1"
                  >
                    <Smile className="w-3 h-3 sm:w-4 sm:h-4" />
                  </Button>
                </div>
                
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90 disabled:bg-[#ffffff33] disabled:text-[#ffffff60] p-2 sm:p-3 flex-shrink-0"
                >
                  <Send className="w-3 h-3 sm:w-4 sm:h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-black p-4">
            <div className="text-center">
              <MessageCircle className="w-12 h-12 sm:w-16 sm:h-16 text-[#ffffff40] mx-auto mb-3 sm:mb-4" />
              <h3 className="text-lg sm:text-xl font-medium text-white mb-2">Select a conversation</h3>
              <p className="text-sm sm:text-base text-[#ffffff60]">Choose a conversation from the sidebar to start messaging</p>
              <Button
                className="mt-4 lg:hidden bg-[#1dff00] text-black hover:bg-[#1dff00]/90"
                onClick={() => setSidebarOpen(true)}
              >
                View Conversations
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};