import React, { useState, useEffect, useRef } from 'react';
import { Bot, ChevronDown, Maximize2, X, Menu, Mic, Send, Minimize2, Copy, Check, Clock, Heart, ThumbsUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CHATBOT_MAX_INPUT_LENGTH } from '@/constants/chatbotConstants';
import './ChatWindow.scss';
import { aiApi } from '@/api/ai';

const ChatWindow = ({ isOpen, onClose }) => {
  const { t, i18n } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('chatbot_messages');
    const lastUpdated = localStorage.getItem('chatbot_last_updated');
    if (saved && lastUpdated) {
      const timeDiff = Date.now() - parseInt(lastUpdated, 10);
      if (timeDiff < 24 * 60 * 60 * 1000) {
        return JSON.parse(saved);
      } else {
        localStorage.removeItem('chatbot_messages');
        localStorage.removeItem('chatbot_last_updated');
      }
    }
    return [
      { id: 1, text: t('chatbot.greeting'), sender: 'bot', timestamp: Date.now() }
    ];
  });
  const [inputValue, setInputValue] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [floatingEmotes, setFloatingEmotes] = useState([]);

  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    localStorage.setItem('chatbot_messages', JSON.stringify(messages));
    localStorage.setItem('chatbot_last_updated', Date.now().toString());
    
    // Update expiration timer whenever messages change
    updateExpirationTime();
  }, [messages]);

  const updateExpirationTime = () => {
    const lastUpdated = localStorage.getItem('chatbot_last_updated');
    if (lastUpdated) {
      const expiresAt = parseInt(lastUpdated, 10) + 24 * 60 * 60 * 1000;
      const remaining = expiresAt - Date.now();
      if (remaining > 0) {
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((remaining % (1000 * 60)) / 1000);
        
        let timeStr = '';
        if (hours > 0) timeStr += `${hours} ${t('chatbot.hours', { defaultValue: 'giờ' })} `;
        if (mins > 0 || hours > 0) timeStr += `${mins} ${t('chatbot.minutes', { defaultValue: 'phút' })} `;
        timeStr += `${secs} ${t('chatbot.seconds', { defaultValue: 'giây' })}`;
        
        setTimeLeft(timeStr.trim());
      } else {
        setTimeLeft(null);
      }
    }
  };

  useEffect(() => {
    updateExpirationTime();
    const timer = setInterval(() => {
      updateExpirationTime();
    }, 1000); // Check every second
    return () => clearInterval(timer);
  }, []);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleReact = (id, type) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === id) {
        const currentReactions = msg.reactions || { heart: 0, like: 0 };
        return {
          ...msg,
          reactions: {
            ...currentReactions,
            [type]: (currentReactions[type] || 0) + 1
          }
        };
      }
      return msg;
    }));
    
    const emoteId = Date.now() + Math.random();
    setFloatingEmotes(prev => [...prev, { id: emoteId, msgId: id, type }]);
    setTimeout(() => {
      setFloatingEmotes(prev => prev.filter(e => e.id !== emoteId));
    }, 1500);
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userText = inputValue.trim();
    const newUserMsg = { id: Date.now(), text: userText, sender: 'user', timestamp: Date.now() };
    const updatedMessages = [...messages, newUserMsg];
    setMessages(updatedMessages);
    setInputValue('');
    setIsTyping(true);

    try {
      const response = await aiApi.chat({
        messages: updatedMessages,
        language: i18n.language || 'vi'
      });

      const replyText = response.data?.reply || t('chatbot.fallback');
      
      setMessages(prev => [...prev, { id: Date.now(), text: replyText, sender: 'bot', timestamp: Date.now() }]);
    } catch (error) {
      console.error('AI Chat Error:', error);
      setMessages(prev => [...prev, { id: Date.now(), text: t('chatbot.error', { message: error.message }), sender: 'bot', timestamp: Date.now() }]);
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
    <div className={`chat-window ${isExpanded ? 'expanded' : ''} ${!isOpen ? 'chat-hidden' : ''}`}>
      <div className="chat-header">
        <div className="header-left">
          <div className="bot-icon">
            <img src="/image-logo.png" alt="ICS-Guard Bot" style={{ width: '70px', height: '70px', objectFit: 'contain' }} />
          </div>
          <span className="title">{t('chatbot.title')}</span>
        </div>
        <div className="header-right">
          <button className="icon-btn" onClick={onClose} title={t('chatbot.minimize')}>
            <ChevronDown size={18} />
          </button>
          <button className="icon-btn" onClick={() => setIsExpanded(!isExpanded)} title={isExpanded ? t('chatbot.minimize_window') : t('chatbot.maximize')}>
            {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button className="icon-btn close-btn" onClick={onClose} title={t('chatbot.close')}>
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
            <div className="message-content">
              <div className={`message-bubble ${(msg.reactions && (msg.reactions.like > 0 || msg.reactions.heart > 0)) ? 'has-reactions' : ''}`} style={{ position: 'relative' }}>
                {msg.text}
                {msg.reactions && (msg.reactions.like > 0 || msg.reactions.heart > 0) && (
                  <div className="reactions-count">
                    {msg.reactions.like > 0 && <span className="react-badge"><ThumbsUp size={10} fill="#3b82f6" color="#3b82f6" /> {msg.reactions.like}</span>}
                    {msg.reactions.heart > 0 && <span className="react-badge"><Heart size={10} fill="#ef4444" color="#ef4444" /> {msg.reactions.heart}</span>}
                  </div>
                )}
              </div>
              <div className="message-actions">
                <span className="msg-time">{new Date(msg.timestamp || msg.id).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                <button className="copy-btn" onClick={() => handleReact(msg.id, 'like')} title={t('chatbot.like')}>
                  <ThumbsUp size={14} />
                </button>
                <button className="copy-btn" onClick={() => handleReact(msg.id, 'heart')} title={t('chatbot.heart')}>
                  <Heart size={14} />
                </button>
                <button className="copy-btn" onClick={() => handleCopy(msg.id, msg.text)} title={t('chatbot.copy')}>
                  {copiedId === msg.id ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                </button>
              </div>
              
              {floatingEmotes.filter(e => e.msgId === msg.id).map(e => (
                <div key={e.id} className={`floating-emote ${e.type}`}>
                  {e.type === 'heart' ? <Heart size={20} fill="#ef4444" color="#ef4444" /> : <ThumbsUp size={20} fill="#3b82f6" color="#3b82f6" />}
                </div>
              ))}
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
            placeholder={t('chatbot.placeholder')} 
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
