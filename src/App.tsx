import { useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  Clock,
  FileText,
  Info,
  Menu,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types — describe every "app" and the windows that hold them on the desktop
// ---------------------------------------------------------------------------

/** How the inside of a window is rendered (welcome screen, text, notepad, etc.) */
type AppType = 'welcome' | 'notepad' | 'calculator';

/** Keys for each launchable app in the start menu and on the desktop */
type AppKey = 'welcome' | 'notepad' | 'calculator';

/** Static definition shared by every instance of the same app */
type AppConfig = {
  title: string;
  icon: JSX.Element;
  type: AppType;
  content: string;
};

/** A running window on the desktop — config plus position and a unique id */
type WebWindow = AppConfig & {
  id: number;
  x: number;
  y: number;
};

/** Tracks which window is being dragged and where the cursor grabbed it */
type DragState = {
  id: number;
  offset: {
    x: number;
    y: number;
  };
};

// ---------------------------------------------------------------------------
// App registry — title, icon, and default content for each program
// ---------------------------------------------------------------------------

const APP_CONFIGS: Record<AppKey, AppConfig> = {
  welcome: {
    title: 'Welcome to TXJ WebOS',
    icon: <Info size={14} />,
    type: 'welcome',
    content: '',
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

/** Icons pinned to the top-left of the desktop (welcome opens on first load) */
const DESKTOP_SHORTCUTS: AppKey[] = ['notepad', 'calculator'];

/** Calculator keypad layout — read left-to-right, top-to-bottom */
const CALCULATOR_BUTTONS = ['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', 'C', '0', '=', '+'];

// ---------------------------------------------------------------------------
// Calculator math — safe expression evaluator (no eval)
// ---------------------------------------------------------------------------

/**
 * Evaluates a basic math expression using the shunting-yard algorithm.
 * Only digits, operators (+ - * /), parentheses, and decimals are allowed.
 */
function calculateExpression(expression: string) {
  // Reject anything that isn't a number, operator, parenthesis, or whitespace
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

    /** Pop two numbers and one operator, then push the result back */
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
      // Numbers go straight onto the value stack
      if (/^\d/.test(token)) {
        values.push(Number(token));
        return;
      }

      // Opening parenthesis — wait for the matching close
      if (token === '(') {
        operators.push(token);
        return;
      }

      // Closing parenthesis — resolve everything until the matching "("
      if (token === ')') {
        while (operators.length && operators[operators.length - 1] !== '(') {
          applyOperator();
        }
        operators.pop();
        return;
      }

      // Operator — resolve higher-or-equal precedence ops on the stack first
      while (
        operators.length &&
        operators[operators.length - 1] !== '(' &&
        precedence[operators[operators.length - 1]] >= precedence[token]
      ) {
        applyOperator();
      }
      operators.push(token);
    });

    // Drain any remaining operators
    while (operators.length) {
      applyOperator();
    }

    const result = values[0];
    return Number.isFinite(result) ? String(Number(result.toFixed(8))) : 'Error';
  } catch {
    return 'Error';
  }
}

// ---------------------------------------------------------------------------
// Root component — the full desktop experience
// ---------------------------------------------------------------------------

export default function App() {
  // --- State ---

  /** All open windows; welcome starts visible on boot */
  const [windows, setWindows] = useState<WebWindow[]>([
    { id: 1, ...APP_CONFIGS.welcome, x: 120, y: 88 },
  ]);

  /** Which window sits on top and receives focus */
  const [activeWindow, setActiveWindow] = useState(1);

  /** Shown in the taskbar clock — updated every second */
  const [time, setTime] = useState(new Date());

  /** Start menu dropdown visibility */
  const [showStartMenu, setShowStartMenu] = useState(false);

  /** Non-null while the user is dragging a window by its title bar */
  const [dragging, setDragging] = useState<DragState | null>(null);

  const formattedTime = useMemo(
    () => time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    [time],
  );

  // Tick the clock once per second
  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // --- Window management ---

  /** Open a new instance of an app, staggered so windows don't stack perfectly */
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
    setWindows((currentWindows) => currentWindows.filter((appWindow) => appWindow.id !== id));
  };

  const updateWindowContent = (id: number, newContent: string) => {
    setWindows((currentWindows) =>
      currentWindows.map((appWindow) =>
        appWindow.id === id ? { ...appWindow, content: newContent } : appWindow,
      ),
    );
  };

  /** Handle a calculator key press for a specific window */
  const handleCalc = (id: number, value: string) => {
    const appWindow = windows.find((item) => item.id === id);
    if (!appWindow) return;

    if (value === 'C') {
      updateWindowContent(id, '0');
      return;
    }

    if (value === '=') {
      updateWindowContent(id, calculateExpression(appWindow.content));
      return;
    }

    // Replace a fresh "0" or "Error" display; otherwise append the digit/operator
    const current =
      appWindow.content === '0' || appWindow.content === 'Error'
        ? value
        : appWindow.content + value;
    updateWindowContent(id, current);
  };

  // --- Drag-and-drop window movement ---

  const startDrag = (event: React.MouseEvent, id: number) => {
    const appWindow = windows.find((item) => item.id === id);
    if (!appWindow) return;

    setDragging({
      id,
      offset: { x: event.clientX - appWindow.x, y: event.clientY - appWindow.y },
    });
    setActiveWindow(id);
  };

  /** Move the dragged window with the cursor, clamped inside the viewport */
  const onMouseMove = (event: React.MouseEvent) => {
    if (!dragging) return;

    const newX = Math.max(0, Math.min(event.clientX - dragging.offset.x, window.innerWidth - 256));
    const newY = Math.max(0, Math.min(event.clientY - dragging.offset.y, window.innerHeight - 320));

    setWindows((currentWindows) =>
      currentWindows.map((appWindow) =>
        appWindow.id === dragging.id ? { ...appWindow, x: newX, y: newY } : appWindow,
      ),
    );
  };

  // --- Per-window body content ---

  const renderContent = (appWindow: WebWindow) => {
    if (appWindow.type === 'welcome') {
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
            {DESKTOP_SHORTCUTS.map((type) => (
              <button key={type} onClick={() => openWindow(type)} className="welcome-action">
                {APP_CONFIGS[type].icon}
                <span>{APP_CONFIGS[type].title}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (appWindow.type === 'notepad') {
      return (
        <textarea
          className="notepad"
          value={appWindow.content}
          onChange={(event) => updateWindowContent(appWindow.id, event.target.value)}
          placeholder="Start typing here..."
          aria-label="Notepad"
        />
      );
    }

    if (appWindow.type === 'calculator') {
      return (
        <div className="calculator-panel">
          <output className="calculator-display">{appWindow.content}</output>
          <div className="calculator-grid">
            {CALCULATOR_BUTTONS.map((button) => (
              <button
                key={button}
                onClick={() => handleCalc(appWindow.id, button)}
                className="calculator-key"
              >
                {button}
              </button>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  // --- Layout: desktop workspace + taskbar ---

  return (
    <main className="desktop" onMouseMove={onMouseMove} onMouseUp={() => setDragging(null)}>
      <section className="workspace" aria-label="TXJ WebOS desktop">
        {/* Desktop shortcut icons */}
        <div className="desktop-icons">
          {DESKTOP_SHORTCUTS.map((key) => (
            <button key={key} onClick={() => openWindow(key)} className="desktop-icon">
              <span className="desktop-icon-glyph">{APP_CONFIGS[key].icon}</span>
              <span>{APP_CONFIGS[key].title}</span>
            </button>
          ))}
        </div>

        {/* Open windows — click to focus, drag title bar to move */}
        {windows.map((appWindow) => (
          <article
            key={appWindow.id}
            onClick={() => setActiveWindow(appWindow.id)}
            style={{
              left: `${appWindow.x}px`,
              top: `${appWindow.y}px`,
              zIndex: activeWindow === appWindow.id ? 10 : 1,
            }}
            className={`window ${appWindow.type === 'welcome' ? 'welcome-window' : ''}`}
          >
            <header className="window-titlebar" onMouseDown={(event) => startDrag(event, appWindow.id)}>
              <span className="window-title">
                {appWindow.icon} {appWindow.title}
              </span>
              <button
                onClick={(event) => closeWindow(event, appWindow.id)}
                className="icon-button"
                aria-label="Close window"
              >
                <X size={14} />
              </button>
            </header>
            {renderContent(appWindow)}
          </article>
        ))}
      </section>

      {/* Bottom taskbar — start menu and live clock */}
      <nav className="taskbar" aria-label="Taskbar">
        <button
          onClick={() => setShowStartMenu(!showStartMenu)}
          className="start-button"
          aria-expanded={showStartMenu}
        >
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
