import { useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  Clock,
  FileText,
  Folder,
  Globe,
  Info,
  Menu,
  Plus,
  Sparkles,
  Terminal,
  X,
} from 'lucide-react';

type AppType = 'welcome' | 'text' | 'notepad' | 'calculator';
type AppKey = 'welcome' | 'terminal' | 'explorer' | 'browser' | 'notepad' | 'calculator';

type AppConfig = {
  title: string;
  icon: JSX.Element;
  type: AppType;
  content: string;
};

type WebWindow = AppConfig & {
  id: number;
  x: number;
  y: number;
};

type DragState = {
  id: number;
  offset: {
    x: number;
    y: number;
  };
};


// welcome window...

const APP_CONFIGS: Record<AppKey, AppConfig> = {
  welcome: {
    title: 'Welcome to TXJ WebOS',
    icon: <Info size={14} />,
    type: 'welcome',
    content: '',
  },
  terminal: {
    title: 'Terminal',
    icon: <Terminal size={14} />,
    type: 'text',
    content: 'txj-shell:~$ launch portfolio',
  },
  explorer: {
    title: 'File Explorer',
    icon: <Folder size={14} />,
    type: 'text',
    content: 'Projects: /portfolio /experiments /webos',
  },
  browser: {
    title: 'Web Browser',
    icon: <Globe size={14} />,
    type: 'text',
    content: 'https://example.com/txj-webos',
  },
  notepad: {
    title: 'Notepad',
    icon: <FileText size={14} />,
    type: 'notepad',
    content: '',
  },
  calculator: {
    title: 'Calculator',
    icon: <Calculator size={14} />,
    type: 'calculator',
    content: '0',
  },
};
//...

// display the desktop shortcuts and calculator buttons........
const DESKTOP_SHORTCUTS: AppKey[] = ['notepad', 'calculator', 'browser', 'explorer'];
const CALCULATOR_BUTTONS = ['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', 'C', '0', '=', '+'];

//...


//hell.
// calculate the result of a mathematical expression
function calculateExpression(expression: string) {
  if (!/^[\d+\-*/.()\s]+$/.test(expression)) {
    return 'Error';
  }

  try {
    const tokens = expression.match(/\d+(?:\.\d+)?|[+\-*/()]/g);
    if (!tokens) {
      return '0';
    }

    const values: number[] = [];
    const operators: string[] = [];
    const precedence: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };

    const applyOperator = () => {
      const operator = operators.pop();
      const right = values.pop();
      const left = values.pop();

      if (!operator || left === undefined || right === undefined) {
        throw new Error('Invalid expression');
      }

      if (operator === '+') values.push(left + right);
      if (operator === '-') values.push(left - right);
      if (operator === '*') values.push(left * right);
      if (operator === '/') values.push(left / right);
    };

    tokens.forEach((token) => {
      if (/^\d/.test(token)) {
        values.push(Number(token));
        return;
      }

      if (token === '(') {
        operators.push(token);
        return;
      }

      if (token === ')') {
        while (operators.length && operators[operators.length - 1] !== '(') {
          applyOperator();
        }
        operators.pop();
        return;
      }

      while (
        operators.length &&
        operators[operators.length - 1] !== '(' &&
        precedence[operators[operators.length - 1]] >= precedence[token]
      ) {
        applyOperator();
      }
      operators.push(token);
    });

    while (operators.length) {
      applyOperator();
    }

    const result = values[0];
    return Number.isFinite(result) ? String(Number(result.toFixed(8))) : 'Error';
  } catch {
    return 'Error';
  }
}
//...


// main app component...
export default function App() {
  const [windows, setWindows] = useState<WebWindow[]>([
    { id: 1, ...APP_CONFIGS.welcome, x: 120, y: 88 },
  ]);
  const [activeWindow, setActiveWindow] = useState(1);
  const [time, setTime] = useState(new Date());
  const [showStartMenu, setShowStartMenu] = useState(false);
  const [dragging, setDragging] = useState<DragState | null>(null);

  const formattedTime = useMemo(
    () => time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    [time],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const openWindow = (type: AppKey) => {
    const id = Date.now();
    const x = Math.max(16, Math.min(150 + windows.length * 20, window.innerWidth - 300));
    const y = Math.max(16, Math.min(130 + windows.length * 20, window.innerHeight - 380));

    setWindows((currentWindows) => [...currentWindows, { id, ...APP_CONFIGS[type], x, y }]);
    setActiveWindow(id);
    setShowStartMenu(false);
  };

  const closeWindow = (event: React.MouseEvent, id: number) => {
    event.stopPropagation();
    setWindows((currentWindows) => currentWindows.filter((win) => win.id !== id));
  };

  const updateWindowContent = (id: number, newContent: string) => {
    setWindows((currentWindows) =>
      currentWindows.map((win) => (win.id === id ? { ...win, content: newContent } : win)),
    );
  };

  const handleCalc = (id: number, value: string) => {
    const win = windows.find((item) => item.id === id);
    if (!win) return;

    if (value === 'C') {
      updateWindowContent(id, '0');
      return;
    }

    if (value === '=') {
      updateWindowContent(id, calculateExpression(win.content));
      return;
    }

    const current = win.content === '0' || win.content === 'Error' ? value : win.content + value;
    updateWindowContent(id, current);
  };

  const startDrag = (event: React.MouseEvent, id: number) => {
    const win = windows.find((item) => item.id === id);
    if (!win) return;

    setDragging({
      id,
      offset: { x: event.clientX - win.x, y: event.clientY - win.y },
    });
    setActiveWindow(id);
  };

  const onMouseMove = (event: React.MouseEvent) => {
    if (!dragging) return;

    const newX = Math.max(0, Math.min(event.clientX - dragging.offset.x, window.innerWidth - 256));
    const newY = Math.max(0, Math.min(event.clientY - dragging.offset.y, window.innerHeight - 320));

    setWindows((currentWindows) =>
      currentWindows.map((win) => (win.id === dragging.id ? { ...win, x: newX, y: newY } : win)),
    );
  };


  //winbow content rendering based on type...
  const renderContent = (win: WebWindow) => {
    if (win.type === 'welcome') {
      return (
        <div className="welcome-panel">
          <div className="welcome-hero">
            <span className="welcome-badge">
              <Sparkles size={14} /> Portfolio OS
            </span>
            <h1>TXJ WebOS</h1>
            <p>
              A tiny desktop inside the browser. Open apps, drag windows around, jot notes, and explore the
              portfolio like it is its own operating system.
            </p>
          </div>

          <div className="welcome-stats" aria-label="System highlights">
            <span>React</span>
            <span>TypeScript</span>
            <span>Vite</span>
          </div>

          <div className="welcome-actions" aria-label="Quick launch">
            {(['notepad', 'calculator', 'browser'] as AppKey[]).map((type) => (
              <button key={type} onClick={() => openWindow(type)} className="welcome-action">
                {APP_CONFIGS[type].icon}
                <span>{APP_CONFIGS[type].title}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }

    // render content for notepad windows
    if (win.type === 'notepad') {
      return (
        <textarea
          className="notepad"
          value={win.content}
          onChange={(event) => updateWindowContent(win.id, event.target.value)}
          placeholder="Start typing here..."
          aria-label="Notepad"
        />
      );
    }


    // render content for calculator window
    if (win.type === 'calculator') {
      return (
        <div className="calculator-panel">
          <output className="calculator-display">{win.content}</output>
          <div className="calculator-grid">
            {CALCULATOR_BUTTONS.map((button) => (
              <button key={button} onClick={() => handleCalc(win.id, button)} className="calculator-key">
                {button}
              </button>
            ))}
          </div>
        </div>
      );
    }

    return <div className="text-panel">{win.content}</div>;
  };


  // main render function for the app
  return (
    <main className="desktop" onMouseMove={onMouseMove} onMouseUp={() => setDragging(null)}>
      <section className="workspace" aria-label="TXJ WebOS desktop">
        <div className="desktop-icons">
          {DESKTOP_SHORTCUTS.map((key) => (
            <button key={key} onClick={() => openWindow(key)} className="desktop-icon">
              <span className="desktop-icon-glyph">{APP_CONFIGS[key].icon}</span>
              <span>{APP_CONFIGS[key].title}</span>
            </button>
          ))}
        </div>

        {windows.map((win) => (
          <article
            key={win.id}
            onClick={() => setActiveWindow(win.id)}
            style={{ left: `${win.x}px`, top: `${win.y}px`, zIndex: activeWindow === win.id ? 10 : 1 }}
            className={`window ${win.type === 'welcome' ? 'welcome-window' : ''}`}
          >
            <header className="window-titlebar" onMouseDown={(event) => startDrag(event, win.id)}>
              <span className="window-title">
                {win.icon} {win.title}
              </span>
              <button onClick={(event) => closeWindow(event, win.id)} className="icon-button" aria-label="Close window">
                <X size={14} />
              </button>
            </header>
            {renderContent(win)}
          </article>
        ))}
      </section>


// taskbar and clock rendering...
      <nav className="taskbar" aria-label="Taskbar">
        <button onClick={() => setShowStartMenu(!showStartMenu)} className="start-button" aria-expanded={showStartMenu}>
          <Menu size={18} /> TXJ WebOS
        </button>
        {showStartMenu && (
          <div className="start-menu">
            {(Object.keys(APP_CONFIGS) as AppKey[]).map((type) => (
              <button key={type} onClick={() => openWindow(type)} className="start-menu-item">
                <Plus size={14} /> {APP_CONFIGS[type].title}
              </button>
            ))}
          </div>
        )}
        <div className="taskbar-spacer" />
        <div className="clock">
          <Clock size={14} /> {formattedTime}
        </div>
      </nav>
    </main>
  );
}
