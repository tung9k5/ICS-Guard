import React, { useState, useEffect, useRef } from 'react';
import { Bot, ChevronDown, Maximize2, X, Menu, Mic, Send, Minimize2, Copy, Check, Heart, ThumbsUp, MoreVertical, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CHATBOT_MAX_INPUT_LENGTH, CHATBOT_STORAGE_KEYS } from '@/constants/chatbotConstants';
import './ChatWindow.scss';
import { aiApi } from '@/api/ai';

const ChatWindow = ({ isOpen, onClose, user }) => {
  const { t, i18n } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState(() => {
    const userId = user?.id || user?._id || 'guest';
    const lastUpdated = localStorage.getItem(`${CHATBOT_STORAGE_KEYS.LAST_UPDATED_PREFIX}${userId}`);
    const saved = localStorage.getItem(`${CHATBOT_STORAGE_KEYS.MESSAGES_PREFIX}${userId}`);
    if (saved && lastUpdated) {
      const timeDiff = Date.now() - parseInt(lastUpdated, 10);
      if (timeDiff < 24 * 60 * 60 * 1000) {
        return JSON.parse(saved);
      } else {
        localStorage.removeItem(`${CHATBOT_STORAGE_KEYS.MESSAGES_PREFIX}${userId}`);
        localStorage.removeItem(`${CHATBOT_STORAGE_KEYS.LAST_UPDATED_PREFIX}${userId}`);
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const chatRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (isOpen && chatRef.current && !chatRef.current.contains(e.target)) {
        const fab = document.querySelector('.chatbot-fab');
        if (fab && fab.contains(e.target)) return;
        const menu = document.querySelector('.chatbot-menu');
        if (menu && menu.contains(e.target)) return;
        onClose();
      }
    };
    
    if (isOpen) {
      setTimeout(() => {
        document.addEventListener('mousedown', handleGlobalClick);
      }, 100);
    }
    return () => document.removeEventListener('mousedown', handleGlobalClick);
  }, [isOpen, onClose]);

  const handleClearMessages = () => {
    const initialMessage = { id: 1, text: t('chatbot.greeting'), sender: 'bot', timestamp: Date.now() };
    setMessages([initialMessage]);
    setIsMenuOpen(false);
  };

  useEffect(() => {
    const userId = user?.id || user?._id || 'guest';
    localStorage.setItem(`${CHATBOT_STORAGE_KEYS.MESSAGES_PREFIX}${userId}`, JSON.stringify(messages));
    localStorage.setItem(`${CHATBOT_STORAGE_KEYS.LAST_UPDATED_PREFIX}${userId}`, Date.now().toString());
    
    // Update expiration timer whenever messages change
    updateExpirationTime();
  }, [messages, user]);

  const updateExpirationTime = () => {
    const userId = user?.id || user?._id || 'guest';
    const lastUpdated = localStorage.getItem(`${CHATBOT_STORAGE_KEYS.LAST_UPDATED_PREFIX}${userId}`);
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
  }, [user]);

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
    const randomX = (Math.random() - 0.5) * 40; // -20px to 20px
    setFloatingEmotes(prev => [...prev, { id: emoteId, msgId: id, type, randomX }]);
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
    <div ref={chatRef} className={`chat-window ${isExpanded ? 'expanded' : ''} ${!isOpen ? 'chat-hidden' : ''}`}>
      <div className="chat-header">
        <div className="header-left">
          <div className="bot-icon">
            <img src="/image-logo.png" alt="ICS-Guard Bot" style={{ width: '5rem', height: '5rem', objectFit: 'contain' }} />
          </div>
          <span className="title">{t('chatbot.title')}</span>
        </div>
        <div className="header-right">
          <div className="menu-container" ref={menuRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <button className="icon-btn" onClick={() => setIsMenuOpen(!isMenuOpen)} title={t('chatbot.options', { defaultValue: 'Tùy chọn' })}>
              <MoreVertical size={18} />
            </button>
            {isMenuOpen && (
              <div className="chat-options-menu" style={{ position: 'absolute', top: '120%', right: 0, backgroundColor: 'var(--bg-card, var(--white))', border: '1px solid var(--border-color, var(--gray-light-2))', borderRadius: '6px', padding: '4px 0', minWidth: '160px', zIndex: 100, boxShadow: '0 4px 12px var(--custom-color-33)' }}>
                <div 
                  className="menu-item" 
                  onClick={() => { setIsExpanded(!isExpanded); setIsMenuOpen(false); }}
                  style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'background-color 0.2s', color: 'var(--text-color, var(--apple-dark-2))' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover, var(--custom-color-32))'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>{isExpanded ? t('chatbot.minimize_window', { defaultValue: 'Thu nhỏ cửa sổ' }) : t('chatbot.maximize', { defaultValue: 'Phóng to' })}</span>
                </div>
                <div 
                  className="menu-item" 
                  onClick={() => { onClose(); setIsMenuOpen(false); }}
                  style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'background-color 0.2s', color: 'var(--text-color, var(--apple-dark-2))' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover, var(--custom-color-32))'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <ChevronDown size={16} />
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>{t('chatbot.minimize', { defaultValue: 'Thu nhỏ chat' })}</span>
                </div>
                <div 
                  className="menu-item" 
                  onClick={handleClearMessages}
                  style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--red-500, var(--red-500))', transition: 'background-color 0.2s', borderTop: '1px solid var(--border-color, var(--gray-200))' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover, var(--custom-color-32))'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <Trash2 size={16} />
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>{t('chatbot.clear_messages', { defaultValue: 'Xóa trò chuyện' })}</span>
                </div>
                <div 
                  className="menu-item" 
                  onClick={() => { onClose(); setIsMenuOpen(false); }}
                  style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--red-500, var(--red-500))', transition: 'background-color 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover, var(--custom-color-32))'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <X size={16} />
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>{t('chatbot.close', { defaultValue: 'Đóng chat' })}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="chat-body">
        {messages.map((msg) => (
          <div key={msg.id} className={`message-row ${msg.sender}`}>
            {msg.sender === 'bot' && (
              <div className="msg-avatar">
                <img src="/image-logo.png" alt="Bot" style={{ width: '4.6429rem', height: '4.6429rem', objectFit: 'contain' }} />
              </div>
            )}
            <div className="message-content">
              <div className={`message-bubble ${(msg.reactions && (msg.reactions.like > 0 || msg.reactions.heart > 0)) ? 'has-reactions' : ''}`} style={{ position: 'relative' }}>
                {msg.text}
                {msg.reactions && (msg.reactions.like > 0 || msg.reactions.heart > 0) && (
                  <div className="reactions-count">
                    {msg.reactions.like > 0 && <span className="react-badge"><ThumbsUp size={10} fill="var(--blue-500)" color="var(--blue-500)" /> {msg.reactions.like}</span>}
                    {msg.reactions.heart > 0 && <span className="react-badge"><Heart size={10} fill="var(--red-500)" color="var(--red-500)" /> {msg.reactions.heart}</span>}
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
                  {copiedId === msg.id ? <Check size={14} color="var(--green-500)" /> : <Copy size={14} />}
                </button>
              </div>
              
              {floatingEmotes.filter(e => e.msgId === msg.id).map(e => (
                <div key={e.id} className={`floating-emote ${e.type}`} style={{ '--random-x': `${e.randomX || 0}px` }}>
                  {e.type === 'heart' ? <Heart size={20} fill="var(--red-500)" color="var(--red-500)" /> : <ThumbsUp size={20} fill="var(--blue-500)" color="var(--blue-500)" />}
                </div>
              ))}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="message-row bot">
            <div className="msg-avatar">
              <img src="/image-logo.png" alt="Bot" style={{ width: '4.6429rem', height: '4.6429rem', objectFit: 'contain' }} />
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
          <button className="action-btn send-btn" onClick={handleSend} style={{ opacity: inputValue.trim() ? 1 : 0.5, pointerEvents: inputValue.trim() ? 'auto' : 'none' }}>
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
