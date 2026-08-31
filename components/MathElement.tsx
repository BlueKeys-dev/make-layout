import React, { useEffect, useRef, useState } from 'react';
import * as katex from 'katex';
import 'katex/dist/katex.min.css';
import { CanvasElement } from '../types';

interface MathElementProps {
    element: CanvasElement;
    onUpdateElement?: (id: string, updates: Partial<CanvasElement>) => void;
    isSelected?: boolean;
}

export const MathElement: React.FC<MathElementProps> = ({
    element,
    onUpdateElement,
    isSelected
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(element.content || '');
    const [error, setError] = useState<string | null>(null);

    // Render KaTeX when content changes
    useEffect(() => {
        if (!containerRef.current || isEditing) return;
        ;
        const formula = element.content || 'E = mc^2';

        try {
            katex.render(formula, containerRef.current, {
                throwOnError: false,
                displayMode: true,
                output: 'html',
                trust: true,
                strict: false,
                macros: {
                    '\\RR': '\\mathbb{R}',
                    '\\NN': '\\mathbb{N}',
                    '\\ZZ': '\\mathbb{Z}',
                    '\\QQ': '\\mathbb{Q}',
                    '\\CC': '\\mathbb{C}',
                },
            });
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Invalid LaTeX');
            if (containerRef.current) {
                containerRef.current.innerHTML = `<span class="text-red-500 text-sm">${formula}</span>`;
            }
        }
    }, [element.content, isEditing]);

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsEditing(true);
        setEditValue(element.content || '');
    };

    const handleBlur = () => {
        setIsEditing(false);
        if (onUpdateElement && editValue !== element.content) {
            onUpdateElement(element.id, { content: editValue });
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        e.stopPropagation();
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleBlur();
        }
        if (e.key === 'Escape') {
            setIsEditing(false);
            setEditValue(element.content || '');
        }
    };

    // Get text color based on element style
    const textColor = element.textStyle?.color || '#ffffff';

    if (isEditing) {
        return (
            <div className="w-full h-full flex flex-col bg-slate-950 border border-slate-700 rounded-lg overflow-hidden shadow-xl">
                <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-300">LaTeX Editor</span>
                    <span className="text-[10px] text-slate-500">Enter to save • Esc to cancel</span>
                </div>
                <textarea
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter LaTeX formula... e.g., \frac{a}{b}"
                    className="flex-1 w-full p-3 bg-slate-950 text-white text-sm font-mono resize-none outline-none"
                    style={{ minHeight: 60 }}
                />
                {/* Live Preview */}
                <div className="px-3 py-2 bg-slate-900 border-t border-slate-900">
                    <div className="text-[10px] text-slate-500 mb-1">Preview:</div>
                    <div
                        className="text-lg text-white"
                        ref={(el) => {
                            if (el) {
                                try {
                                    katex.render(editValue || 'E = mc^2', el, {
                                        throwOnError: false,
                                        displayMode: false,
                                        strict: false,
                                        trust: true,
                                    });
                                } catch {
                                    el.innerHTML = `<span class="text-red-400 text-xs">Invalid formula</span>`;
                                }
                            }
                        }}
                    />
                </div>
            </div>
        );
    }

    return (
        <div
            className="w-full h-full flex items-center justify-center select-none cursor-pointer group/math rounded-[24px] border border-slate-900 shadow-lg overflow-hidden"
            style={{
                backgroundColor: (element.color && element.color !== 'transparent') ? element.color : '#18131236', // Default to slate-950 (black shade)
                color: textColor,
            }}
            onDoubleClick={handleDoubleClick}
        >
            {/* Formula Container */}
            <div
                ref={containerRef}
                className="katex-display-wrapper px-4 py-2"
                style={{
                    fontSize: element.textStyle?.fontSize ? `${element.textStyle.fontSize}px` : '18px',
                    textAlign: element.textStyle?.textAlign || 'center',
                }}
            />

            {/* Error indicator */}
            {error && (
                <div className="absolute bottom-1 right-1 bg-red-500/80 text-white text-[10px] px-2 py-0.5 rounded">
                    ⚠ Error
                </div>
            )}

            {/* Edit hint */}
            {isSelected && (
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-slate-400 whitespace-nowrap opacity-0 group-hover/math:opacity-100 transition-opacity">
                    Double-click to edit LaTeX
                </div>
            )}
        </div>
    );
};

// Helper: Common math formulas for quick insertion
export const COMMON_FORMULAS = [
    { name: 'Quadratic Formula', latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
    { name: 'Pythagorean Theorem', latex: 'a^2 + b^2 = c^2' },
    { name: 'Einstein\'s Mass-Energy', latex: 'E = mc^2' },
    { name: 'Euler\'s Identity', latex: 'e^{i\\pi} + 1 = 0' },
    { name: 'Integral', latex: '\\int_{a}^{b} f(x) \\, dx' },
    { name: 'Derivative', latex: '\\frac{d}{dx} f(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}' },
    { name: 'Summation', latex: '\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}' },
    { name: 'Matrix', latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
    { name: 'Binomial Coefficient', latex: '\\binom{n}{k} = \\frac{n!}{k!(n-k)!}' },
    { name: 'Trigonometric Identity', latex: '\\sin^2\\theta + \\cos^2\\theta = 1' },
];
