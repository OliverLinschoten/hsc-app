import { useRef, useEffect, useState, useCallback } from 'react';
import './Scratchpad.css';

const COLORS = ['#000000', '#e53e3e', '#3182ce', '#38a169', '#e8ff47'];
const SIZES = [2, 4, 8];

export default function Scratchpad({ imageUrl }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [eraser, setEraser] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const lastPos = useRef(null);
  const historyRef = useRef([]);
  const [historyLen, setHistoryLen] = useState(0);
  const penErasingRef = useRef(false);

  // Resize canvas to match the displayed image size
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Save current drawing before resize
    const prevData = canvas.width > 0 && canvas.height > 0
      ? canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
      : null;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Restore drawing after resize if dimensions match
    if (prevData && prevData.width === canvas.width && prevData.height === canvas.height) {
      ctx.putImageData(prevData, 0, 0);
    }
  }, []);

  // Save a snapshot of the canvas to history
  const saveSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    historyRef.current.push(snapshot);
    // Cap history at 50 to avoid memory issues
    if (historyRef.current.length > 50) {
      historyRef.current.shift();
    }
    setHistoryLen(historyRef.current.length);
  }, []);

  // Undo last stroke
  const undo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || historyRef.current.length === 0) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    if (historyRef.current.length === 1) {
      // Only one snapshot = clear to blank
      historyRef.current.pop();
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    } else {
      // Pop current state, restore previous
      historyRef.current.pop();
      const prev = historyRef.current[historyRef.current.length - 1];
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.putImageData(prev, 0, 0);
      ctx.restore();
    }
    setHistoryLen(historyRef.current.length);
  }, []);

  // Setup on mount and when image loads
  useEffect(() => {
    const img = containerRef.current?.querySelector('img');
    if (!img) return;

    const onLoad = () => setupCanvas();
    img.addEventListener('load', onLoad);
    if (img.complete) setupCanvas();

    window.addEventListener('resize', setupCanvas);
    return () => {
      img.removeEventListener('load', onLoad);
      window.removeEventListener('resize', setupCanvas);
    };
  }, [setupCanvas, imageUrl]);

  // Keyboard shortcut: Ctrl+Z / Cmd+Z for undo
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    let clientX, clientY;
    if (e.touches) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDraw = (e) => {
    e.preventDefault();

    // Detect stylus eraser button (button 5 = eraser tip, buttons 32 = eraser held)
    const isPenEraser = e.pointerType === 'pen' && (e.buttons === 32 || e.button === 5);
    penErasingRef.current = isPenEraser;

    // Save snapshot before starting a new stroke
    saveSnapshot();

    setDrawing(true);
    lastPos.current = getPos(e);
  };

  const draw = (e) => {
    if (!drawing) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e);

    const useEraser = eraser || penErasingRef.current;

    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = useEraser ? 'rgba(0,0,0,1)' : color;
    ctx.globalCompositeOperation = useEraser ? 'destination-out' : 'source-over';
    ctx.lineWidth = useEraser ? size * 3 : size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    lastPos.current = pos;
  };

  const endDraw = () => {
    setDrawing(false);
    lastPos.current = null;
    penErasingRef.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Save before clearing so we can undo it
    saveSnapshot();

    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  };

  return (
    <div className="scratchpad">
      <div className="scratchpad-toolbar">
        <button
          className={`sp-tool-toggle ${toolsOpen ? 'active' : ''}`}
          onClick={() => setToolsOpen(o => !o)}
          title="Drawing tools"
        >
          ✏️ Draw
        </button>

        {toolsOpen && (
          <div className="sp-tools">
            <div className="sp-colors">
              {COLORS.map(c => (
                <button
                  key={c}
                  className={`sp-color ${color === c && !eraser ? 'active' : ''}`}
                  style={{ background: c }}
                  onClick={() => { setColor(c); setEraser(false); }}
                  title={c}
                />
              ))}
            </div>

            <div className="sp-sizes">
              {SIZES.map((s, i) => (
                <button
                  key={s}
                  className={`sp-size ${size === s && !eraser ? 'active' : ''}`}
                  onClick={() => { setSize(s); setEraser(false); }}
                  title={['Thin', 'Medium', 'Thick'][i]}
                >
                  <span className="sp-size-dot" style={{ width: s + 4, height: s + 4 }} />
                </button>
              ))}
            </div>

            <button
              className={`sp-eraser ${eraser ? 'active' : ''}`}
              onClick={() => setEraser(e => !e)}
              title="Eraser"
            >
              Eraser
            </button>

            <button
              className={`sp-undo ${historyLen === 0 ? 'disabled' : ''}`}
              onClick={undo}
              disabled={historyLen === 0}
              title="Undo (Ctrl+Z)"
            >
              ↩ Undo
            </button>

            <button className="sp-clear" onClick={clearCanvas} title="Clear all">
              Clear
            </button>
          </div>
        )}
      </div>

      <div
        className={`scratchpad-container ${toolsOpen ? 'drawing-mode' : ''}`}
        ref={containerRef}
      >
        <img src={imageUrl} alt="Question" className="scratchpad-img" />
        <canvas
          ref={canvasRef}
          className={`scratchpad-canvas ${toolsOpen ? 'active' : ''}`}
          onPointerDown={toolsOpen ? startDraw : undefined}
          onPointerMove={toolsOpen ? draw : undefined}
          onPointerUp={toolsOpen ? endDraw : undefined}
          onPointerLeave={toolsOpen ? endDraw : undefined}
          onTouchStart={toolsOpen ? (e) => e.preventDefault() : undefined}
        />
      </div>
    </div>
  );
}