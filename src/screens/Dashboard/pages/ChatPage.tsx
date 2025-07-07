import React, { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Send, Paperclip, Smile, MoreVertical } from "lucide-react";
import { motion } from "framer-motion";

interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  timestamp: string;
  isOwn: boolean;
  avatar?: string;
}

const ChatPage = (): JSX.Element => {
  const [newMessage, setNewMessage] = useState("");

  const messages: ChatMessage[] = [
    {
      id: "1",
      sender: "System",
      message: "Your application for the role of UI/UX designer at Google LLC requires your current street address.",
      timestamp: "10:30 AM",
      isOwn: false
    },
    {
      id: "2",
      sender: "You",
      message: "Your application for the role of UI/UX designer at Google LLC requires your current street address. Click on the button to fill in the form",
      timestamp: "10:35 AM",
      isOwn: true
    }
  ];

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      setNewMessage("");
    }
  };

  return (
    <div className="h-full flex flex-col bg-black min-h-screen">
      {/* Main Chat Content */}
      <div className="flex-1 flex flex-col w-full max-w-7xl mx-auto">
        {/* Chat Header */}
        <div className="bg-[#0a0a0a] border-b border-[#ffffff1a] p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-full flex items-center justify-center">
                <span className="text-black font-bold text-sm sm:text-base">AI</span>
              </div>
              <div>
                <h2 className="text-white font-semibold text-base sm:text-lg">JobRaker Assistant</h2>
                <p className="text-[#ffffff80] text-xs sm:text-sm">Always here to help</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-[#ffffff80] hover:text-white hover:bg-[#ffffff1a] hover:scale-110 transition-all duration-300"
            >
              <MoreVertical className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 bg-black">
          {/* System Message 1 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex justify-start"
          >
            <div className="max-w-xs sm:max-w-md lg:max-w-lg xl:max-w-xl">
              <motion.div 
                className="bg-[#ffffff1a] text-white p-3 sm:p-4 lg:p-5 rounded-2xl border border-[#ffffff33] hover:border-[#1dff00]/50 hover:shadow-lg transition-all duration-300"
                whileHover={{ scale: 1.02 }}
              >
                <p className="text-xs sm:text-sm lg:text-base leading-relaxed">
                  Your application for the role of UI/UX designer at Google LLC requires your current street address.
                </p>
                <div className="text-xs text-[#ffffff60] mt-2">10:30 AM</div>
              </motion.div>
            </div>
          </motion.div>

          {/* System Message 2 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex justify-end"
          >
            <div className="max-w-xs sm:max-w-md lg:max-w-lg xl:max-w-xl">
              <motion.div 
                className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] text-white p-3 sm:p-4 lg:p-5 rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
                whileHover={{ scale: 1.02 }}
              >
                <p className="text-xs sm:text-sm lg:text-base leading-relaxed">
                  Your application for the role of UI/UX designer at Google LLC requires your current street address. Click on the button to fill in the form
                </p>
                <div className="text-xs text-white/80 mt-2 text-right">10:35 AM</div>
              </motion.div>
            </div>
          </motion.div>

          {/* Typing indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="flex justify-start"
          >
            <div className="bg-[#ffffff1a] p-3 sm:p-4 rounded-2xl border border-[#ffffff33]">
              <div className="flex space-x-1">
                <motion.div
                  className="w-2 h-2 bg-[#1dff00] rounded-full"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                />
                <motion.div
                  className="w-2 h-2 bg-[#1dff00] rounded-full"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                />
                <motion.div
                  className="w-2 h-2 bg-[#1dff00] rounded-full"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Message Input */}
        <div className="p-4 sm:p-6 lg:p-8 bg-[#0a0a0a] border-t border-[#ffffff1a]">
          <div className="flex items-center space-x-2 sm:space-x-3 lg:space-x-4">
            {/* Attachment button */}
            <Button
              variant="ghost"
              size="sm"
              className="text-[#ffffff80] hover:text-white hover:bg-[#ffffff1a] hover:scale-110 transition-all duration-300 p-2 sm:p-3"
            >
              <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>

            {/* Message input */}
            <div className="flex-1 relative">
              <Input
                placeholder="Type in a message"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                className="bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60] focus:border-[#1dff00] hover:border-[#ffffff4d] pr-12 sm:pr-14 py-3 sm:py-4 rounded-full text-sm sm:text-base transition-all duration-300"
              />
              <Button
                onClick={handleSendMessage}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-gradient-to-r from-[#1dff00] to-[#0a8246] text-black hover:shadow-lg hover:scale-110 rounded-full w-8 h-8 sm:w-10 sm:h-10 p-0 flex items-center justify-center transition-all duration-300"
              >
                <Send className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </div>

            {/* Emoji button */}
            <Button
              variant="ghost"
              size="sm"
              className="text-[#ffffff80] hover:text-white hover:bg-[#ffffff1a] hover:scale-110 transition-all duration-300 p-2 sm:p-3"
            >
              <Smile className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap gap-2 mt-3 sm:mt-4">
            {["Help with resume", "Find jobs", "Interview tips", "Salary negotiation"].map((action) => (
              <motion.button
                key={action}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-3 py-1 sm:px-4 sm:py-2 bg-[#ffffff1a] text-[#ffffff80] hover:text-white hover:bg-[#ffffff26] rounded-full text-xs sm:text-sm border border-[#ffffff33] hover:border-[#1dff00]/50 transition-all duration-300"
              >
                {action}
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;