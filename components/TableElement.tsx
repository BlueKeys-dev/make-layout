import React, { useState, useRef, useEffect } from 'react';
import * as katex from 'katex';
import 'katex/dist/katex.min.css';
import { CanvasElement } from '../types';

interface TableElementProps {
    element: CanvasElement;
    onUpdateElement?: (id: string, updates: Partial<CanvasElement>) => void;
}

// Helper: Detect if content looks like a math formula
const isMathContent = (content: string): boolean => {
    if (!content) return false;
    // Check for LaTeX commands or math patterns
    const mathPatterns = [
        /\\frac\{/,      // \frac{}
        /\\sqrt/,        // \sqrt
        /\\int/,         // \int
        /\\sum/,         // \sum
        /\\prod/,        // \prod
        /\\lim/,         // \lim
        /\\alpha|\\beta|\\gamma|\\theta|\\pi|\\lambda|\\omega/i,
        /\^[\d{]/,       // Powers like x^2 or x^{n}
        /_[\d{]/,        // Subscripts like x_1 or x_{min}
        /\\pm/,          // plus-minus
        /\\times/,       // multiplication
        /\\div/,         // division
        /\\infty/,       // infinity
        /\\partial/,     // partial derivative
        /\\to|\\rightarrow/,
        /\\begin\{/,     // matrices etc
        /d\/dx/i,        // derivative notation
        /\∫|∑|∏|√|π|α|β|γ|θ|∞/, // Unicode math symbols
    ];
    return mathPatterns.some(pattern => pattern.test(content));
};

// Convert simple math notation to LaTeX
const convertToLatex = (content: string): string => {
    let latex = content;

    // Common conversions from plain text to LaTeX
    latex = latex.replace(/d\/dx\s*\[([^\]]+)\]/g, '\\frac{d}{dx}\\left[$1\\right]');
    latex = latex.replace(/d\/dx/g, '\\frac{d}{dx}');
    latex = latex.replace(/dy\/dx/g, '\\frac{dy}{dx}');
    latex = latex.replace(/dy\/du/g, '\\frac{dy}{du}');
    latex = latex.replace(/du\/dx/g, '\\frac{du}{dx}');
    latex = latex.replace(/(\w+)'(?=\s*=)/g, "$1'"); // Keep primes
    latex = latex.replace(/\(([^)]+)\)'/g, "($1)'"); // (uv)'
    latex = latex.replace(/\*\*/g, '^'); // ** to ^
    latex = latex.replace(/\*(?![*\s])/g, ' \\cdot '); // * to cdot
    latex = latex.replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}');
    latex = latex.replace(/\bsin\(/g, '\\sin(');
    latex = latex.replace(/\bcos\(/g, '\\cos(');
    latex = latex.replace(/\btan\(/g, '\\tan(');
    latex = latex.replace(/\bln\|([^|]+)\|/g, '\\ln|$1|');
    latex = latex.replace(/\bln\(/g, '\\ln(');
    latex = latex.replace(/\be\^/g, 'e^');
    latex = latex.replace(/\bpi\b/gi, '\\pi');
    latex = latex.replace(/\binfinity\b/gi, '\\infty');
    latex = latex.replace(/>=|≥/g, '\\geq');
    latex = latex.replace(/<=|≤/g, '\\leq');
    latex = latex.replace(/!=/g, '\\neq');
    latex = latex.replace(/\+-/g, '\\pm');
    latex = latex.replace(/->/g, '\\to');

    // Handle integrals: ∫ x^n dx
    latex = latex.replace(/∫\s*([^\s]+)\s*dx/g, '\\int $1 \\, dx');
    latex = latex.replace(/\[a,b\]/g, '\\int_a^b');

    return latex;
};

// Component to render KaTeX content
const MathCell: React.FC<{ content: string; className?: string }> = ({ content, className }) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!ref.current || !content) return;

        try {
            // Try to detect and convert to LaTeX if needed
            let latex = content;
            if (!content.includes('\\') && isMathContent(content)) {
                latex = convertToLatex(content);
            }

            katex.render(latex, ref.current, {
                throwOnError: false,
                displayMode: false,
                output: 'html',
                strict: false,
            });
        } catch (err) {
            // If KaTeX fails, just show plain text
            if (ref.current) {
                ref.current.textContent = content;
            }
        }
    }, [content]);

    return <div ref={ref} className={className} />;
};

export const TableElement: React.FC<TableElementProps> = ({ element, onUpdateElement }) => {
    const [editingCell, setEditingCell] = useState<{ r: number, c: number } | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Ensure table data exists
    const rows = element.tableData?.rows || 3;
    const cols = element.tableData?.cols || 3;
    const headers = element.tableData?.headers || Array(cols).fill('Header');
    const data = element.tableData?.data || Array(rows - 1).fill(Array(cols).fill('Cell'));

    useEffect(() => {
        if (editingCell && inputRef.current) {
            inputRef.current.focus();
        }
    }, [editingCell]);

    const handleHeaderChange = (c: number, value: string) => {
        if (!element.tableData || !onUpdateElement) return;
        const newData = { ...element.tableData };
        const newHeaders = [...newData.headers];
        newHeaders[c] = value;
        newData.headers = newHeaders;
        onUpdateElement(element.id, { tableData: newData });
    };

    const handleBodyChange = (r: number, c: number, value: string) => {
        if (!element.tableData || !onUpdateElement) return;
        const newData = { ...element.tableData };
        const rowIndex = r;
        const newBody = [...newData.data];
        // Ensure row exists
        if (!newBody[rowIndex]) newBody[rowIndex] = Array(cols).fill('');

        const newRow = [...newBody[rowIndex]];
        newRow[c] = value;
        newBody[rowIndex] = newRow;
        newData.data = newBody;
        onUpdateElement(element.id, { tableData: newData });
    };

    // Render cell content - detect math and render with KaTeX
    const renderCellContent = (content: string, isHeader: boolean = false) => {
        if (!content) return null;

        // Check if content looks like math
        if (isMathContent(content)) {
            return (
                <MathCell
                    content={content}
                    className={`w-full h-full p-2 text-xs ${isHeader ? 'font-bold' : ''} flex items-center dark:text-gray-100`}
                />
            );
        }

        return (
            <div className={`w-full h-full p-2 text-xs ${isHeader ? 'font-bold' : ''} truncate dark:text-slate-200`}>
                {content}
            </div>
        );
    };

    return (
        <div className="w-full h-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 overflow-hidden select-none flex flex-col rounded-[24px] shadow-sm">
            <div className="w-full h-full grid" style={{
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gridTemplateRows: `auto repeat(${rows - 1}, 1fr)`
            }}>
                {/* Headers */}
                {Array.from({ length: cols }).map((_, c) => (
                    <div
                        key={`h-${c}`}
                        className="bg-slate-100 dark:bg-slate-950 p-0 border-b border-r border-slate-200 dark:border-slate-700 last:border-r-0 flex items-center relative"
                        onDoubleClick={(e) => { e.stopPropagation(); setEditingCell({ r: 0, c }); }}
                    >
                        {editingCell?.r === 0 && editingCell.c === c ? (
                            <input
                                ref={inputRef}
                                className="w-full h-full px-2 bg-white dark:bg-black outline-none text-xs font-bold"
                                value={headers[c] || ''}
                                onChange={(e) => handleHeaderChange(c, e.target.value)}
                                onBlur={() => setEditingCell(null)}
                                onKeyDown={(e) => {
                                    e.stopPropagation();
                                    if (e.key === 'Enter') setEditingCell(null);
                                }}
                            />
                        ) : (
                            renderCellContent(headers[c], true)
                        )}
                    </div>
                ))}

                {/* Cells */}
                {Array.from({ length: rows - 1 }).map((_, r) => (
                    Array.from({ length: cols }).map((__, c) => (
                        <div
                            key={`c-${r}-${c}`}
                            className="p-0 border-b border-r border-slate-200 dark:border-slate-800 last:border-r-0 flex items-center relative"
                            onDoubleClick={(e) => { e.stopPropagation(); setEditingCell({ r: r + 1, c }); }}
                        >
                            {editingCell?.r === r + 1 && editingCell.c === c ? (
                                <input
                                    ref={inputRef}
                                    className="w-full h-full px-2 bg-white dark:bg-black outline-none text-xs"
                                    value={data[r]?.[c] || ''}
                                    onChange={(e) => handleBodyChange(r, c, e.target.value)}
                                    onBlur={() => setEditingCell(null)}
                                    onKeyDown={(e) => {
                                        e.stopPropagation();
                                        if (e.key === 'Enter') setEditingCell(null);
                                    }}
                                />
                            ) : (
                                renderCellContent(data[r]?.[c])
                            )}
                        </div>
                    ))
                ))}
            </div>
        </div>
    );
};
