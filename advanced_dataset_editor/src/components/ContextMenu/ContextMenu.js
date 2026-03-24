import React, { useState, useEffect, useRef } from 'react';
import './ContextMenu.css';

const ContextMenu = ({ x, y, visible, onClose, options, annotation }) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('contextmenu', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('contextmenu', handleClickOutside);
    };
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        left: x,
        top: y,
      }}
    >
      {options.map((option, index) => (
        <div
          key={index}
          className={`context-menu-item ${option.disabled ? 'disabled' : ''}`}
          onClick={() => {
            if (!option.disabled) {
              option.action(annotation);
              onClose();
            }
          }}
        >
          {option.icon && <span className="context-menu-icon">{option.icon}</span>}
          {option.label}
        </div>
      ))}
    </div>
  );
};

export default ContextMenu;