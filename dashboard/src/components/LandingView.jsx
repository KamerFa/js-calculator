import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Canvas, useFrame, useThree } from '@react-three/fiber';

/* ═══════════════════════════════════════════════════════════════
   THREE.JS SCENE — Floating shapes, particles, mouse-reactive
   ═══════════════════════════════════════════════════════════════ */

function FloatingShape({ position, color, speed, rotSpeed, type, args }) {
  const mesh = useRef();
  const origin = useRef(position);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    mesh.current.position.y = origin.current[1] + Math.sin(t * speed) * 0.6;
    mesh.current.position.x = origin.current[0] + Math.cos(t * speed * 0.7) * 0.3;
    mesh.current.rotation.x += rotSpeed * 0.008;
    mesh.current.rotation.y += rotSpeed * 0.012;
  });

  const geo = {
    torus: <torusGeometry args={args || [1, 0.4, 16, 32]} />,
    icosahedron: <icosahedronGeometry args={args || [1, 0]} />,
    octahedron: <octahedronGeometry args={args || [1]} />,
    dodecahedron: <dodecahedronGeometry args={args || [1]} />,
    torusKnot: <torusKnotGeometry args={args || [0.8, 0.3, 64, 16]} />,
  };

  return (
    <mesh ref={mesh} position={position}>
      {geo[type] || geo.icosahedron}
      <meshPhysicalMaterial color={color} wireframe transparent opacity={0.3} roughness={0.2} metalness={0.8} />
    </mesh>
  );
}

function ParticleField({ count = 600 }) {
  const points = useRef();
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    return pos;
  }, [count]);

  useFrame((state) => {
    points.current.rotation.y = state.clock.elapsedTime * 0.02;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.04} color="#5b9aef" transparent opacity={0.5} sizeAttenuation />
    </points>
  );
}

function HeroScene() {
  const group = useRef();
  const { pointer } = useThree();

  useFrame(() => {
    group.current.rotation.y += (pointer.x * 0.3 - group.current.rotation.y) * 0.02;
    group.current.rotation.x += (pointer.y * 0.15 - group.current.rotation.x) * 0.02;
  });

  return (
    <>
      <ambientLight intensity={0.25} />
      <pointLight position={[10, 10, 10]} intensity={1.2} color="#2a5caa" />
      <pointLight position={[-10, -5, 8]} intensity={0.8} color="#a855f7" />
      <pointLight position={[0, -8, 6]} intensity={0.5} color="#22c55e" />
      <group ref={group}>
        <FloatingShape position={[-4, 2, -3]} color="#5b9aef" speed={0.6} rotSpeed={1} type="torus" args={[1.2, 0.4, 16, 32]} />
        <FloatingShape position={[4, -1, -4]} color="#a855f7" speed={0.8} rotSpeed={1.3} type="icosahedron" args={[1.3, 0]} />
        <FloatingShape position={[0, 3, -5]} color="#22c55e" speed={0.5} rotSpeed={0.9} type="octahedron" args={[1]} />
        <FloatingShape position={[-3, -2, -6]} color="#f59e0b" speed={0.7} rotSpeed={1.1} type="dodecahedron" args={[0.9]} />
        <FloatingShape position={[5, 2.5, -7]} color="#ec4899" speed={0.9} rotSpeed={0.7} type="torusKnot" args={[0.7, 0.25, 64, 16]} />
        <FloatingShape position={[-5, -3, -5]} color="#06b6d4" speed={0.4} rotSpeed={1.5} type="torus" args={[0.8, 0.3, 16, 32]} />
        <FloatingShape position={[2, -3, -8]} color="#8b5cf6" speed={0.65} rotSpeed={0.8} type="icosahedron" args={[0.7, 1]} />
        <FloatingShape position={[-1, -4, -4]} color="#f97316" speed={0.55} rotSpeed={1.2} type="octahedron" args={[0.6]} />
      </group>
      <ParticleField count={600} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HOOKS — Scroll reveal & animated counters
   ═══════════════════════════════════════════════════════════════ */

function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

function useCounter(end, duration = 2000) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (!started) return;
    const isFloat = !Number.isInteger(end);
    let frame;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = eased * end;
      setCount(isFloat ? Math.round(val * 10) / 10 : Math.floor(val));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [started, end, duration]);
  return [count, () => setStarted(true)];
}

/* ═══════════════════════════════════════════════════════════════
   ANIMATED SVG ILLUSTRATIONS
   ═══════════════════════════════════════════════════════════════ */

function ProductivitySVG({ animate }) {
  return (
    <svg className="lp-svg" viewBox="0 0 400 280" fill="none">
      <defs>
        <linearGradient id="pg1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5b9aef" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      {/* Board bg */}
      <rect x="30" y="10" width="340" height="260" rx="16" fill="url(#pg1)" opacity="0.06" />
      {/* Col 1 — To Do */}
      <g className={animate ? 'lp-svg-fade' : ''} style={{ animationDelay: '0.15s' }}>
        <rect x="50" y="30" width="90" height="10" rx="5" fill="#5b9aef" opacity="0.5" />
        <rect x="45" y="52" width="100" height="56" rx="10" fill="#5b9aef" opacity="0.08" stroke="#5b9aef" strokeOpacity="0.15" />
        <rect x="57" y="66" width="56" height="6" rx="3" fill="#5b9aef" opacity="0.4" />
        <rect x="57" y="80" width="36" height="4" rx="2" fill="#5b9aef" opacity="0.2" />
        <circle cx="130" cy="93" r="6" fill="#5b9aef" opacity="0.25" />
      </g>
      <g className={animate ? 'lp-svg-fade' : ''} style={{ animationDelay: '0.35s' }}>
        <rect x="45" y="118" width="100" height="50" rx="10" fill="#5b9aef" opacity="0.08" stroke="#5b9aef" strokeOpacity="0.15" />
        <rect x="57" y="132" width="64" height="6" rx="3" fill="#5b9aef" opacity="0.4" />
        <rect x="57" y="144" width="42" height="4" rx="2" fill="#5b9aef" opacity="0.2" />
      </g>
      {/* Col 2 — In Progress */}
      <g className={animate ? 'lp-svg-fade' : ''} style={{ animationDelay: '0.25s' }}>
        <rect x="155" y="30" width="90" height="10" rx="5" fill="#a855f7" opacity="0.5" />
        <rect x="150" y="52" width="100" height="70" rx="10" fill="#a855f7" opacity="0.08" stroke="#a855f7" strokeOpacity="0.15" />
        <rect x="162" y="66" width="50" height="6" rx="3" fill="#a855f7" opacity="0.4" />
        <rect x="162" y="80" width="68" height="4" rx="2" fill="#a855f7" opacity="0.2" />
        <rect x="162" y="92" width="70" height="5" rx="2.5" fill="#a855f7" opacity="0.1" />
        <rect x="162" y="92" width="0" height="5" rx="2.5" fill="#a855f7" opacity="0.45" className={animate ? 'lp-svg-progress' : ''} style={{ animationDelay: '0.8s' }} />
        <rect x="162" y="106" width="30" height="4" rx="2" fill="#a855f7" opacity="0.2" />
      </g>
      {/* Col 3 — Done */}
      <g className={animate ? 'lp-svg-fade' : ''} style={{ animationDelay: '0.4s' }}>
        <rect x="260" y="30" width="90" height="10" rx="5" fill="#22c55e" opacity="0.5" />
      </g>
      <g className={animate ? 'lp-svg-fade' : ''} style={{ animationDelay: '0.55s' }}>
        <rect x="255" y="52" width="100" height="56" rx="10" fill="#22c55e" opacity="0.08" stroke="#22c55e" strokeOpacity="0.15" />
        <rect x="267" y="66" width="58" height="6" rx="3" fill="#22c55e" opacity="0.4" />
        <rect x="267" y="80" width="40" height="4" rx="2" fill="#22c55e" opacity="0.2" />
        <circle cx="340" cy="93" r="9" fill="#22c55e" opacity="0.2" className={animate ? 'lp-svg-pop' : ''} style={{ animationDelay: '1s' }} />
        <path d="M334 93 L338 97 L346 89" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" className={animate ? 'lp-svg-check' : ''} style={{ animationDelay: '1.2s' }} />
      </g>
      <g className={animate ? 'lp-svg-fade' : ''} style={{ animationDelay: '0.7s' }}>
        <rect x="255" y="118" width="100" height="50" rx="10" fill="#22c55e" opacity="0.08" stroke="#22c55e" strokeOpacity="0.15" />
        <rect x="267" y="132" width="52" height="6" rx="3" fill="#22c55e" opacity="0.4" />
        <rect x="267" y="144" width="66" height="4" rx="2" fill="#22c55e" opacity="0.2" />
        <circle cx="340" cy="153" r="9" fill="#22c55e" opacity="0.2" className={animate ? 'lp-svg-pop' : ''} style={{ animationDelay: '1.3s' }} />
        <path d="M334 153 L338 157 L346 149" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" className={animate ? 'lp-svg-check' : ''} style={{ animationDelay: '1.5s' }} />
      </g>
      {/* Arrow from col 2 → col 3 */}
      <path d="M252 87 L253 87" stroke="#a855f7" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.3" className={animate ? 'lp-svg-arrow' : ''} style={{ animationDelay: '0.9s' }} />
      {/* Sparkles */}
      <circle cx="310" cy="210" r="3" fill="#22c55e" className={animate ? 'lp-svg-sparkle' : ''} style={{ animationDelay: '1.6s' }} />
      <circle cx="80" cy="200" r="2" fill="#5b9aef" className={animate ? 'lp-svg-sparkle' : ''} style={{ animationDelay: '1.8s' }} />
      <circle cx="200" cy="240" r="2.5" fill="#a855f7" className={animate ? 'lp-svg-sparkle' : ''} style={{ animationDelay: '2s' }} />
    </svg>
  );
}

function CommunicationSVG({ animate }) {
  return (
    <svg className="lp-svg" viewBox="0 0 400 280" fill="none">
      <defs>
        <linearGradient id="cg1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5b9aef" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      {/* Connection line */}
      <line x1="110" y1="140" x2="290" y2="140" stroke="url(#cg1)" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.2" className={animate ? 'lp-svg-line-grow' : ''} style={{ animationDelay: '0.1s' }} />
      {/* Left user */}
      <g className={animate ? 'lp-svg-pop' : ''} style={{ animationDelay: '0.2s' }}>
        <circle cx="85" cy="140" r="28" fill="#5b9aef" opacity="0.12" stroke="#5b9aef" strokeOpacity="0.2" />
        <circle cx="85" cy="132" r="10" fill="#5b9aef" opacity="0.35" />
        <ellipse cx="85" cy="154" rx="14" ry="8" fill="#5b9aef" opacity="0.25" />
      </g>
      {/* Right user */}
      <g className={animate ? 'lp-svg-pop' : ''} style={{ animationDelay: '0.35s' }}>
        <circle cx="315" cy="140" r="28" fill="#ec4899" opacity="0.12" stroke="#ec4899" strokeOpacity="0.2" />
        <circle cx="315" cy="132" r="10" fill="#ec4899" opacity="0.35" />
        <ellipse cx="315" cy="154" rx="14" ry="8" fill="#ec4899" opacity="0.25" />
      </g>
      {/* Bubble left → right */}
      <g className={animate ? 'lp-svg-bubble-l' : ''} style={{ animationDelay: '0.5s' }}>
        <rect x="130" y="78" width="120" height="44" rx="12" fill="#5b9aef" opacity="0.1" stroke="#5b9aef" strokeOpacity="0.15" />
        <rect x="144" y="92" width="70" height="5" rx="2.5" fill="#5b9aef" opacity="0.35" />
        <rect x="144" y="103" width="48" height="4" rx="2" fill="#5b9aef" opacity="0.2" />
        <polygon points="145,122 155,122 140,132" fill="#5b9aef" opacity="0.1" />
      </g>
      {/* Bubble right → left */}
      <g className={animate ? 'lp-svg-bubble-r' : ''} style={{ animationDelay: '0.9s' }}>
        <rect x="170" y="150" width="130" height="44" rx="12" fill="#ec4899" opacity="0.1" stroke="#ec4899" strokeOpacity="0.15" />
        <rect x="184" y="164" width="80" height="5" rx="2.5" fill="#ec4899" opacity="0.35" />
        <rect x="184" y="175" width="55" height="4" rx="2" fill="#ec4899" opacity="0.2" />
        <polygon points="280,194 270,194 285,204" fill="#ec4899" opacity="0.1" />
      </g>
      {/* Typing dots */}
      <g className={animate ? 'lp-svg-fade' : ''} style={{ animationDelay: '1.3s' }}>
        <rect x="138" y="212" width="60" height="28" rx="14" fill="#5b9aef" opacity="0.08" />
        <circle cx="155" cy="226" r="3.5" fill="#5b9aef" opacity="0.3" className={animate ? 'lp-svg-typing-dot' : ''} style={{ animationDelay: '1.4s' }} />
        <circle cx="168" cy="226" r="3.5" fill="#5b9aef" opacity="0.3" className={animate ? 'lp-svg-typing-dot' : ''} style={{ animationDelay: '1.55s' }} />
        <circle cx="181" cy="226" r="3.5" fill="#5b9aef" opacity="0.3" className={animate ? 'lp-svg-typing-dot' : ''} style={{ animationDelay: '1.7s' }} />
      </g>
      {/* Emoji reaction floating */}
      <text x="260" y="78" fontSize="20" className={animate ? 'lp-svg-emoji-float' : ''} style={{ animationDelay: '1.5s' }}>❤️</text>
      <text x="160" y="260" fontSize="16" className={animate ? 'lp-svg-emoji-float' : ''} style={{ animationDelay: '1.8s' }}>🔥</text>
    </svg>
  );
}

function FunCultureSVG({ animate }) {
  const confettiPieces = useMemo(() => {
    const pieces = [];
    const colors = ['#ec4899', '#f59e0b', '#22c55e', '#5b9aef', '#a855f7', '#06b6d4'];
    for (let i = 0; i < 24; i++) {
      pieces.push({
        x: 80 + Math.random() * 240,
        y: 60 + Math.random() * 160,
        w: 4 + Math.random() * 6,
        h: 2 + Math.random() * 3,
        r: Math.random() * 360,
        color: colors[i % colors.length],
        delay: 0.3 + Math.random() * 1.5,
      });
    }
    return pieces;
  }, []);

  return (
    <svg className="lp-svg" viewBox="0 0 400 280" fill="none">
      {/* Burst rings */}
      <circle cx="200" cy="140" r="0" stroke="#f59e0b" strokeWidth="2" fill="none" opacity="0" className={animate ? 'lp-svg-burst' : ''} style={{ animationDelay: '0.3s' }} />
      <circle cx="200" cy="140" r="0" stroke="#ec4899" strokeWidth="1.5" fill="none" opacity="0" className={animate ? 'lp-svg-burst' : ''} style={{ animationDelay: '0.6s' }} />
      <circle cx="200" cy="140" r="0" stroke="#a855f7" strokeWidth="1.5" fill="none" opacity="0" className={animate ? 'lp-svg-burst' : ''} style={{ animationDelay: '0.9s' }} />
      {/* Confetti */}
      {confettiPieces.map((p, i) => (
        <rect
          key={i}
          x={p.x} y={p.y}
          width={p.w} height={p.h}
          rx="1"
          fill={p.color}
          opacity="0"
          transform={`rotate(${p.r} ${p.x + p.w / 2} ${p.y + p.h / 2})`}
          className={animate ? 'lp-svg-confetti' : ''}
          style={{ animationDelay: `${p.delay}s` }}
        />
      ))}
      {/* Music notes */}
      <text x="100" y="90" fontSize="24" opacity="0" className={animate ? 'lp-svg-note' : ''} style={{ animationDelay: '0.5s' }}>🎵</text>
      <text x="280" y="80" fontSize="20" opacity="0" className={animate ? 'lp-svg-note' : ''} style={{ animationDelay: '0.8s' }}>🎶</text>
      <text x="180" y="60" fontSize="18" opacity="0" className={animate ? 'lp-svg-note' : ''} style={{ animationDelay: '1.1s' }}>🎵</text>
      {/* Central emoji */}
      <g className={animate ? 'lp-svg-pop' : ''} style={{ animationDelay: '0.2s' }}>
        <circle cx="200" cy="140" r="40" fill="#f59e0b" opacity="0.1" />
        <circle cx="200" cy="140" r="32" fill="#f59e0b" opacity="0.08" stroke="#f59e0b" strokeOpacity="0.15" />
        <circle cx="188" cy="132" r="4" fill="#f59e0b" opacity="0.5" />
        <circle cx="212" cy="132" r="4" fill="#f59e0b" opacity="0.5" />
        <path d="M186 150 Q200 164 214 150" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.5" className={animate ? 'lp-svg-check' : ''} style={{ animationDelay: '0.6s' }} />
      </g>
      {/* Stars / sparkles */}
      <circle cx="140" cy="80" r="3" fill="#f59e0b" className={animate ? 'lp-svg-sparkle' : ''} style={{ animationDelay: '1.2s' }} />
      <circle cx="270" cy="100" r="2.5" fill="#ec4899" className={animate ? 'lp-svg-sparkle' : ''} style={{ animationDelay: '1.4s' }} />
      <circle cx="120" cy="180" r="2" fill="#22c55e" className={animate ? 'lp-svg-sparkle' : ''} style={{ animationDelay: '1.6s' }} />
      <circle cx="300" cy="190" r="3" fill="#5b9aef" className={animate ? 'lp-svg-sparkle' : ''} style={{ animationDelay: '1.8s' }} />
      <circle cx="200" cy="220" r="2" fill="#a855f7" className={animate ? 'lp-svg-sparkle' : ''} style={{ animationDelay: '2s' }} />
      {/* Floating emojis */}
      <text x="90" y="200" fontSize="18" opacity="0" className={animate ? 'lp-svg-emoji-float' : ''} style={{ animationDelay: '1s' }}>🎉</text>
      <text x="290" y="220" fontSize="16" opacity="0" className={animate ? 'lp-svg-emoji-float' : ''} style={{ animationDelay: '1.3s' }}>🚀</text>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

function FeatureCard({ title, desc, children, delay = 0 }) {
  const [ref, visible] = useReveal();
  return (
    <div
      ref={ref}
      className={`lp-feature-card lp-reveal${visible ? ' visible' : ''}`}
      style={{ transitionDelay: `${delay}s` }}
    >
      <div className="lp-feature-svg">{children}</div>
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  );
}

function StatItem({ value, suffix, label, icon }) {
  const [ref, visible] = useReveal();
  const [count, start] = useCounter(value, 2200);

  useEffect(() => { if (visible) start(); }, [visible]);

  return (
    <div
      ref={ref}
      className={`lp-stat-item lp-reveal${visible ? ' visible' : ''}`}
    >
      <span className="lp-stat-icon">{icon}</span>
      <span className="lp-stat-value">{count}{suffix}</span>
      <span className="lp-stat-label">{label}</span>
    </div>
  );
}

const TILES = [
  { icon: '📋', name: 'Smart Tasks', desc: 'Kanban boards, priorities & deadlines' },
  { icon: '💬', name: 'Team Chat', desc: 'Real-time messaging with threads' },
  { icon: '📅', name: 'Calendar', desc: 'Schedule, plan & never miss a beat' },
  { icon: '📝', name: 'Notes', desc: 'Rich text editor for your ideas' },
  { icon: '🌐', name: 'Community', desc: 'Social feeds & shared spaces' },
  { icon: '🎯', name: 'Focus Timer', desc: 'Pomodoro technique, built right in' },
  { icon: '📻', name: 'Live Radio', desc: 'Background music while you work' },
  { icon: '👤', name: 'Profiles', desc: 'Custom profiles & presence status' },
];

/* ═══════════════════════════════════════════════════════════════
   INTERACTIVE MOUSE-GLOW SECTION
   ═══════════════════════════════════════════════════════════════ */

function GlowGrid() {
  const gridRef = useRef(null);
  const [glow, setGlow] = useState({ x: 0, y: 0, active: false });
  const [tileRef, tilesVisible] = useReveal();

  const handleMove = useCallback((e) => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;
    setGlow({ x: e.clientX - rect.left, y: e.clientY - rect.top, active: true });
  }, []);

  return (
    <div ref={(el) => { gridRef.current = el; tileRef.current = el; }}>
      <div
        className={`lp-tiles-grid lp-reveal${tilesVisible ? ' visible' : ''}`}
        onMouseMove={handleMove}
        onMouseLeave={() => setGlow((g) => ({ ...g, active: false }))}
        style={glow.active ? { '--glow-x': `${glow.x}px`, '--glow-y': `${glow.y}px` } : undefined}
      >
        {TILES.map((tile, i) => (
          <div key={tile.name} className="lp-tile" style={{ transitionDelay: `${i * 0.06}s` }}>
            <span className="lp-tile-icon">{tile.icon}</span>
            <span className="lp-tile-name">{tile.name}</span>
            <span className="lp-tile-desc">{tile.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN LANDING PAGE
   ═══════════════════════════════════════════════════════════════ */

export default function LandingView() {
  const navigate = useNavigate();
  const [heroReady, setHeroReady] = useState(false);
  const [featRef1, feat1Vis] = useReveal();
  const [featRef2, feat2Vis] = useReveal();
  const [featRef3, feat3Vis] = useReveal();
  const [navScrolled, setNavScrolled] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHeroReady(true), 200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const handler = () => setNavScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const scrollToFeatures = () => {
    document.getElementById('lp-features')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="landing">
      {/* ── Navbar ── */}
      <nav className={`lp-nav${navScrolled ? ' scrolled' : ''}`}>
        <div className="lp-nav-inner">
          <span className="lp-nav-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <span className="lp-nav-logo-icon">◆</span> FlowSpace
          </span>
          <div className="lp-nav-links">
            <a href="#lp-features" onClick={(e) => { e.preventDefault(); scrollToFeatures(); }}>Features</a>
            <a href="#lp-showcase" onClick={(e) => { e.preventDefault(); document.getElementById('lp-showcase')?.scrollIntoView({ behavior: 'smooth' }); }}>Showcase</a>
            <button className="lp-nav-signin" onClick={() => navigate('/')}>Sign In</button>
            <button className="lp-nav-cta" onClick={() => navigate('/')}>Get Started</button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="lp-hero">
        <div className="lp-hero-canvas">
          <Canvas camera={{ position: [0, 0, 8], fov: 60 }} dpr={[1, 1.5]}>
            <HeroScene />
          </Canvas>
        </div>
        <div className={`lp-hero-content${heroReady ? ' ready' : ''}`}>
          <h1 className="lp-hero-title">
            Work Smarter.
            <br />
            <span className="lp-gradient-text">Connect Faster.</span>
            <br />
            Have Fun.
          </h1>
          <p className="lp-hero-sub">
            The all-in-one workspace that brings your team together with powerful
            productivity tools, seamless communication, and a culture that makes
            work feel less like work.
          </p>
          <div className="lp-hero-buttons">
            <button className="lp-btn-primary" onClick={() => navigate('/')}>
              Get Started Free
              <span className="lp-btn-arrow">→</span>
            </button>
            <button className="lp-btn-secondary" onClick={scrollToFeatures}>
              Explore Features
            </button>
          </div>
        </div>
        <div className={`lp-scroll-hint${heroReady ? ' ready' : ''}`}>
          <div className="lp-scroll-mouse">
            <div className="lp-scroll-wheel" />
          </div>
          <span>Scroll to explore</span>
        </div>
      </section>

      {/* ── Wave divider ── */}
      <div className="lp-wave">
        <svg viewBox="0 0 1440 100" preserveAspectRatio="none">
          <path d="M0,60 C320,100 520,20 720,50 C920,80 1120,20 1440,60 L1440,100 L0,100 Z" />
        </svg>
      </div>

      {/* ── Features ── */}
      <section id="lp-features" className="lp-features">
        <div className="lp-section-header">
          <h2 className="lp-section-title">Supercharge Your Workflow</h2>
          <p className="lp-section-sub">Three pillars that make your team unstoppable</p>
        </div>
        <div className="lp-features-grid">
          <div ref={featRef1}>
            <FeatureCard title="Boost Your Productivity" desc="Manage tasks with intelligent boards, track progress with visual timelines, and stay focused with built-in Pomodoro timers." delay={0}>
              <ProductivitySVG animate={feat1Vis} />
            </FeatureCard>
          </div>
          <div ref={featRef2}>
            <FeatureCard title="Communicate Effortlessly" desc="Real-time messaging with threads, @mentions, emoji reactions, and rich media sharing. Stay connected without the noise." delay={0.15}>
              <CommunicationSVG animate={feat2Vis} />
            </FeatureCard>
          </div>
          <div ref={featRef3}>
            <FeatureCard title="Make Work Fun" desc="Community feeds, live radio, customizable themes, and interactive profiles. Build a workplace culture your team actually enjoys." delay={0.3}>
              <FunCultureSVG animate={feat3Vis} />
            </FeatureCard>
          </div>
        </div>
      </section>

      {/* ── Showcase tiles ── */}
      <section id="lp-showcase" className="lp-showcase">
        <div className="lp-section-header">
          <h2 className="lp-section-title">Everything You Need</h2>
          <p className="lp-section-sub">A complete toolkit for modern teams</p>
        </div>
        <GlowGrid />
      </section>

      {/* ── Stats ── */}
      <section className="lp-stats">
        <StatItem value={10000} suffix="+" label="Tasks Completed" icon="✅" />
        <StatItem value={50000} suffix="+" label="Messages Sent" icon="💬" />
        <StatItem value={99} suffix="%" label="Uptime" icon="⚡" />
        <StatItem value={4.9} suffix="/5" label="User Rating" icon="⭐" />
      </section>

      {/* ── Final CTA ── */}
      <section className="lp-final-cta">
        <div className="lp-final-cta-glow" />
        <h2>Ready to Transform Your Workflow?</h2>
        <p>Join thousands of teams already building better together.</p>
        <button className="lp-btn-primary lp-btn-lg" onClick={() => navigate('/')}>
          Start Free Today
          <span className="lp-btn-arrow">→</span>
        </button>
      </section>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <span className="lp-footer-brand">◆ FlowSpace</span>
        <span className="lp-footer-copy">© 2036 FlowSpace. Designed for the future.</span>
      </footer>
    </div>
  );
}
