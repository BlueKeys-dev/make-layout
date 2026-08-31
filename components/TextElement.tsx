import React, { useRef, useState, useEffect, useCallback } from 'react';
import { CanvasElement } from '../types';

interface TextElementProps {
  element: CanvasElement;
  onUpdateElement?: (id: string, updates: Partial<CanvasElement>) => void;
  isSelected?: boolean;
  onEditChange?: (isEditing: boolean) => void;
}

export const TextElement: React.FC<TextElementProps> = ({ element, onUpdateElement, isSelected, onEditChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  const contentSetRef = useRef(false); // Track if we've set initial content

  // Set content only when NOT editing AND content hasn't been set yet or element.content changed
  useEffect(() => {
    if (textRef.current && !isEditing) {
      textRef.current.innerHTML = element.content || '';
      contentSetRef.current = true;
    }
  }, [element.content, isEditing]);

  const getTextStyle = useCallback(() => {
    if (!element.textStyle) return {};
    return {
      fontSize: element.textStyle.fontSize ? `${element.textStyle.fontSize}px` : undefined,
      fontWeight: element.textStyle.fontWeight || undefined,
      fontStyle: element.textStyle.fontStyle || undefined,
      textAlign: element.textStyle.textAlign || 'center',
      color: element.textStyle.color || undefined,
      lineHeight: element.textStyle.lineHeight || 1.5,
      fontFamily: element.textStyle.fontFamily || 'Inter, sans-serif'
    };
  }, [element.textStyle]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    onEditChange?.(true);
    // Focus after state update
    setTimeout(() => textRef.current?.focus(), 0);
  };

  const handleBlur = () => {
    if (textRef.current && onUpdateElement) {
      const newContent = textRef.current.innerHTML;
      onUpdateElement(element.id, { content: newContent });
    }
    setIsEditing(false);
    onEditChange?.(false);
  };

  // Handle auto-edit on creation
  useEffect(() => {
    if (element.justCreated) {
      setIsEditing(true);
      onEditChange?.(true);
      if (onUpdateElement) {
        onUpdateElement(element.id, { justCreated: false });
      }
      setTimeout(() => {
        if (textRef.current) {
          textRef.current.focus();
          try { document.execCommand('selectAll', false, undefined); } catch (e) {}
        }
      }, 0);
    }
  }, [element.justCreated, element.id, onUpdateElement, onEditChange]);

  return (
    <div
      ref={textRef}
      className={`w-full h-full p-0.5 break-words outline-none ${
 
        !isEditing ? 'cursor-move select-none' : 'cursor-text select-text bg-white/50 dark:bg-black/50'
      }`}
      style={getTextStyle()}
      contentEditable={isEditing}
      onBlur={handleBlur}
      onDoubleClick={handleDoubleClick}
      suppressContentEditableWarning={true}
      onKeyDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => { if (isEditing) e.stopPropagation(); }}
    />
  );
};
