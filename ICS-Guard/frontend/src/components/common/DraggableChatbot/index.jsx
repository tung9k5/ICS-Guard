import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ChatWindow from './ChatWindow';
import './DraggableChatbot.scss';

const DraggableChatbot = () => {
  const { t } = useTranslation();
  const [position, setPosition] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 80 });
  const [isDragging, setIsDragging] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isChatWindowOpen, setIsChatWindowOpen] = useState(false);
  const hasMoved = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  useEffect(() => {

    const handleResize = () => {
      setPosition(prev => ({
        x: Math.min(prev.x, window.innerWidth - 60),
        y: Math.min(prev.y, window.innerHeight - 60)
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMouseDown = (e) => {
    if (e.type === 'mousedown' && e.button !== 0) return;
    setIsDragging(true);
    hasMoved.current = false;
    
    const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
    
    offset.current = {
      x: clientX - position.x,
      y: clientY - position.y
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    hasMoved.current = true;
    
    const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
    
    const newX = clientX - offset.current.x;
    const newY = clientY - offset.current.y;

    const maxX = window.innerWidth - 60;
    const maxY = window.innerHeight - 60;
    setPosition({
      x: Math.min(Math.max(newX, 0), maxX),
      y: Math.min(Math.max(newY, 0), maxY)
    });
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
    }
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleMouseMove, { passive: false });
      window.addEventListener('touchend', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, position]);

  const handleClick = (e) => {
    if (hasMoved.current) {
      e.stopPropagation();
      return;
    }
    setIsOpen(!isOpen);
    if (isChatWindowOpen) {
      setIsChatWindowOpen(false);
    }
  };

  return (
    <>
      <div
        className="draggable-chatbot"
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
      >
        {isOpen && (
          <div className="chatbot-menu">
            <div 
              className="chatbot-sub-fab telegram-fab" 
              title="Telegram"
              onClick={() => window.open('https://telegram.org', '_blank')}
              style={{ padding: 0, overflow: 'hidden' }}
            >
              <img src="/image-telegram.png" alt="Telegram" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.05)' }} />
            </div>
            <div 
              className="chatbot-sub-fab"
              title="Hệ thống"
              onClick={() => {
                setIsChatWindowOpen(true);
                setIsOpen(false);
              }}
            >
              <MessageSquare size={24} />
            </div>
          </div>
        )}

        <div
          className={`chatbot-fab ${isDragging ? 'dragging' : ''}`}
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}
          onClick={handleClick}
        >
          {isOpen || isChatWindowOpen ? <X size={28} /> : <User size={28} />}
        </div>
      </div>

      {isChatWindowOpen && <ChatWindow onClose={() => setIsChatWindowOpen(false)} />}
    </>
  );
};

export default DraggableChatbot;
