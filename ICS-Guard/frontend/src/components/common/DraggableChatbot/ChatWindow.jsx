import React, { useState, useEffect, useRef } from 'react';
import { Bot, ChevronDown, Maximize2, X, Menu, Mic, Send, Minimize2 } from 'lucide-react';
import './ChatWindow.scss';

const MOCK_REPLIES = [
  "Chào bạn, tôi là trợ lý ảo ICS-Guard. Tôi có thể giúp gì cho bạn hôm nay?",
  "Hệ thống đang hoạt động ổn định. Mọi chỉ số đều trong ngưỡng an toàn.",
  "Tôi đã ghi nhận yêu cầu của bạn. Đang tiến hành phân tích hệ thống...",
  "Vui lòng cung cấp thêm thông tin để tôi có thể hỗ trợ tốt nhất."
];

const ChatWindow = ({ onClose }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, text: "👋 Mình là trợ lý AI sẵn sàng hỗ trợ bạn về hệ thống ICS-Guard. Bạn cần giúp gì?", sender: 'bot' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const newUserMsg = { id: Date.now(), text: inputValue.trim(), sender: 'user' };
    setMessages(prev => [...prev, newUserMsg]);
    setInputValue('');
    setIsTyping(true);

    // Mock bot reply
    setTimeout(() => {
      const reply = MOCK_REPLIES[Math.floor(Math.random() * MOCK_REPLIES.length)];
      setMessages(prev => [...prev, { id: Date.now(), text: reply, sender: 'bot' }]);
      setIsTyping(false);
    }, 1500);
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
            onChange={(e) => setInputValue(e.target.value.substring(0, 500))}
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
