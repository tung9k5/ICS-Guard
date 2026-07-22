import React, { useState, useEffect, useRef } from 'react';
import { Bot, ChevronDown, Maximize2, X, Menu, Mic, Send, Minimize2 } from 'lucide-react';
import { CHATBOT_MAX_INPUT_LENGTH } from '@/constants/chatbotConstants';
import './ChatWindow.scss';
import { aiApi } from '@/api/ai';

const ChatWindow = ({ onClose }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('chatbot_messages');
    const lastUpdated = localStorage.getItem('chatbot_last_updated');
    if (saved && lastUpdated) {
      const timeDiff = Date.now() - parseInt(lastUpdated, 10);
      if (timeDiff < 15 * 60 * 1000) {
        return JSON.parse(saved);
      } else {
        localStorage.removeItem('chatbot_messages');
        localStorage.removeItem('chatbot_last_updated');
      }
    }
    return [
      { id: 1, text: "👋 Mình là trợ lý AI sẵn sàng hỗ trợ bạn về hệ thống ICS-Guard. Bạn cần giúp gì?", sender: 'bot' }
    ];
  });
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    localStorage.setItem('chatbot_messages', JSON.stringify(messages));
    localStorage.setItem('chatbot_last_updated', Date.now().toString());
  }, [messages]);
  
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userText = inputValue.trim();
    const newUserMsg = { id: Date.now(), text: userText, sender: 'user' };
    const updatedMessages = [...messages, newUserMsg];
    setMessages(updatedMessages);
    setInputValue('');
    setIsTyping(true);

    try {
      const response = await aiApi.chat({
        messages: updatedMessages
      });

      const replyText = response.data?.reply || 'Xin lỗi, tôi không thể trả lời lúc này.';
      
      setMessages(prev => [...prev, { id: Date.now(), text: replyText, sender: 'bot' }]);
    } catch (error) {
      console.error('AI Chat Error:', error);
      setMessages(prev => [...prev, { id: Date.now(), text: `Đã xảy ra lỗi khi kết nối với AI: ${error.message}`, sender: 'bot' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div className={`chat-window ${isExpanded ? 'expanded' : ''}`}>
      <div className="chat-header">
        <div className="header-left">
          <div className="bot-icon">
            <img src="/image-logo.png" alt="ICS-Guard Bot" style={{ width: '70px', height: '70px', objectFit: 'contain' }} />
          </div>
          <span className="title">Trợ lý ảo ICS-Guard</span>
        </div>
        <div className="header-right">
          <button className="icon-btn" onClick={onClose} title="Thu nhỏ">
            <ChevronDown size={18} />
          </button>
          <button className="icon-btn" onClick={() => setIsExpanded(!isExpanded)} title={isExpanded ? "Thu nhỏ cửa sổ" : "Phóng to"}>
            {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button className="icon-btn close-btn" onClick={onClose} title="Đóng">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="chat-body">
        {messages.map((msg) => (
          <div key={msg.id} className={`message-row ${msg.sender}`}>
            {msg.sender === 'bot' && (
              <div className="msg-avatar">
                <img src="/image-logo.png" alt="Bot" style={{ width: '65px', height: '65px', objectFit: 'contain' }} />
              </div>
            )}
            <div className="message-bubble">
              {msg.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="message-row bot">
            <div className="msg-avatar">
              <img src="/image-logo.png" alt="Bot" style={{ width: '65px', height: '65px', objectFit: 'contain' }} />
            </div>
            <div className="message-bubble typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-footer">
        <div className="input-container">
          <button className="action-btn">
            <Menu size={20} />
          </button>
          <input 
            type="text" 
            placeholder="Hãy hỏi tôi bất cứ điều gì..." 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value.substring(0, CHATBOT_MAX_INPUT_LENGTH))}
            onKeyPress={handleKeyPress}
          />
          {inputValue.trim() ? (
            <button className="action-btn send-btn" onClick={handleSend}>
              <Send size={18} />
            </button>
          ) : (
            <button className="action-btn">
              <Mic size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
