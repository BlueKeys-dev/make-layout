import React, { useMemo, useRef, useEffect } from 'react';
import { CanvasElement } from '../types';
import { RefreshCw, Play, Pause } from 'lucide-react';

interface P5ElementProps {
    element: CanvasElement;
    onUpdateElement?: (id: string, updates: Partial<CanvasElement>) => void;
}

// HTML template for p5.js iframe
const createP5Html = (code: string): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { 
      width: 100%; 
      height: 100%; 
      overflow: hidden; 
      background: #1a1a1a;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    canvas { 
      display: block; 
      max-width: 100%;
      max-height: 100%;
    }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>
</head>
<body>
  <script>
    try {
      ${code}
    } catch (e) {
      console.error('P5.js Error:', e);
      document.body.innerHTML = '<div style="color: #ff6b6b; padding: 20px; font-family: monospace;">' + e.message + '</div>';
    }
  </script>
</body>
</html>
`;

export const P5Element: React.FC<P5ElementProps> = ({ element }) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [isPlaying, setIsPlaying] = React.useState(true);
    const [key, setKey] = React.useState(0); // Force re-render trigger

    const code = element.p5Data?.code || '';

    // Create blob URL for iframe
    const iframeSrc = useMemo(() => {
        if (!code) return 'about:blank';
        const blob = new Blob([createP5Html(code)], { type: 'text/html' });
        return URL.createObjectURL(blob);
    }, [code, key]);

    // Cleanup blob URL
    useEffect(() => {
        return () => {
            if (iframeSrc && iframeSrc !== 'about:blank') {
                URL.revokeObjectURL(iframeSrc);
            }
        };
    }, [iframeSrc]);

    const handleReset = (e: React.MouseEvent) => {
        e.stopPropagation();
        setKey(k => k + 1);
        setIsPlaying(true);
    };

    const togglePlayPause = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isPlaying) {
            if (iframeRef.current) {
                iframeRef.current.src = 'about:blank';
            }
        } else {
            setKey(k => k + 1);
        }
        setIsPlaying(!isPlaying);
    };

    if (!code) {
        return (
            <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center text-white/40 text-sm">
                No p5.js code available
            </div>
        );
    }

    return (
        <div className="w-full h-full relative bg-[#1a1a1a] rounded overflow-hidden group">
            <iframe
                ref={iframeRef}
                src={isPlaying ? iframeSrc : 'about:blank'}
                className="w-full h-full border-0"
                sandbox="allow-scripts"
                allow="accelerometer; gyroscope; magnetometer"
                title="p5.js Animation"
            />

            {/* Overlay controls - appear on hover */}
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button
                    onClick={togglePlayPause}
                    className="p-1.5 bg-white/90 hover:bg-white rounded-lg shadow-md transition-colors"
                    title={isPlaying ? 'Pause' : 'Play'}
                >
                    {isPlaying ? <Pause size={14} className="text-gray-800" /> : <Play size={14} fill="currentColor" className="text-gray-800" />}
                </button>
                <button
                    onClick={handleReset}
                    className="p-1.5 bg-white/90 hover:bg-white rounded-lg shadow-md transition-colors"
                    title="Reset"
                >
                    <RefreshCw size={14} className="text-gray-800" />
                </button>
            </div>

            {/* Topic label */}
            {element.p5Data?.topic && (
                <div className="absolute bottom-2 left-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-white/80 text-xs truncate opacity-0 group-hover:opacity-100 transition-opacity">
                    {element.p5Data.topic}
                </div>
            )}
        </div>
    );
};

export default P5Element;
