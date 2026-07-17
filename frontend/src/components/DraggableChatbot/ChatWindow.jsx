import React, { useState, useEffect, useRef } from 'react';
import { Bot, ChevronDown, Maximize2, X, Menu, Mic, Send, Minimize2 } from 'lucide-react';
import { CHATBOT_MOCK_REPLY_DELAY_MS, CHATBOT_MAX_INPUT_LENGTH, MOCK_REPLIES } from '@/constants/chatbotConstants';
import './ChatWindow.scss';

import { GoogleGenAI } from "@google/genai";

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
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        setMessages(prev => [...prev, { id: Date.now(), text: 'Thiếu cấu hình VITE_GEMINI_API_KEY trong file .env', sender: 'bot' }]);
        setIsTyping(false);
        return;
      }

      let apiContents = [];
      let currentRole = null;
      let currentText = [];

      updatedMessages.forEach(msg => {
        const role = msg.sender === 'bot' ? 'model' : 'user';
        if (role !== currentRole) {
          if (currentRole !== null) {
            apiContents.push({ role: currentRole, parts: [{ text: currentText.join('\n') }] });
          }
          currentRole = role;
          currentText = [msg.text];
        } else {
          currentText.push(msg.text);
        }
      });
      if (currentRole !== null) {
        apiContents.push({ role: currentRole, parts: [{ text: currentText.join('\n') }] });
      }

      const firstUserIndex = apiContents.findIndex(msg => msg.role === 'user');
      if (firstUserIndex > 0) {
        apiContents = apiContents.slice(firstUserIndex);
      }

      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: "Bạn là chuyên gia an ninh mạng công nghiệp (OT/ICS Security Expert) và là trợ lý ảo của hệ thống ICS-Guard. Nhiệm vụ của bạn là hỗ trợ phân tích cảnh báo (Alerts), sự cố (Incidents), giám sát thiết bị (Devices) và giải đáp các vấn đề về hệ thống SCADA/ICS. Hãy trả lời ngắn gọn, chuyên nghiệp, chính xác và luôn dùng tiếng Việt. Nếu người dùng hỏi vấn đề không liên quan, hãy từ chối lịch sự và hướng họ về chủ đề an ninh mạng. TUYỆT ĐỐI KHÔNG sử dụng bất kỳ định dạng Markdown nào (không dùng dấu sao *, in đậm, in nghiêng, gạch đầu dòng). Chỉ trả lời bằng văn bản thuần túy (plain text)."
              }
            ]
          },
          contents: apiContents
        })
      });

      const data = await response.json();
      
      if (data.error) {
         throw new Error(data.error.message || 'Lỗi từ Gemini API');
      }

      const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Xin lỗi, tôi không thể trả lời lúc này.';
      
      setMessages(prev => [...prev, { id: Date.now(), text: replyText, sender: 'bot' }]);
    } catch (error) {
      console.error('Gemini API Error:', error);
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
