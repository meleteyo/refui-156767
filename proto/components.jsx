// Shared UI primitives
const { useState, useEffect, useMemo, useRef } = React;

// Korean number formatting
const fmt = (n) => new Intl.NumberFormat('ko-KR').format(n);
const pad = (n) => String(n).padStart(2, '0');

const ChannelBadge = ({ channel, size = "sm" }) => {
  const map = {
    KAKAO: { label: "알림톡", bg: "bg-purple-500/15", text: "text-purple-300", border: "border-purple-500/30" },
    EMAIL: { label: "이메일", bg: "bg-emerald-500/15", text: "text-emerald-300", border: "border-emerald-500/30" },
    FAX:   { label: "웹팩스", bg: "bg-cyan-500/15",    text: "text-cyan-300",    border: "border-cyan-500/30" },
  };
  const c = map[channel] || map.EMAIL;
  const px = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border ${c.bg} ${c.text} ${c.border} ${px} font-medium`}>
      {channel === "KAKAO" && <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>}
      {channel === "EMAIL" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
      {channel === "FAX"   && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>}
      {c.label}
    </span>
  );
};

const StatusPill = ({ status }) => {
  const map = {
    SUCCESS: { label: "성공", bg: "bg-emerald-500/15", text: "text-emerald-300", dot: "bg-emerald-400" },
    FAILED:  { label: "실패", bg: "bg-rose-500/15",    text: "text-rose-300",    dot: "bg-rose-400" },
    PENDING: { label: "대기", bg: "bg-slate-500/15",   text: "text-slate-300",   dot: "bg-slate-400" },
    SENDING: { label: "발송중", bg: "bg-amber-500/15", text: "text-amber-300",   dot: "bg-amber-400" },
  };
  const c = map[status] || map.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md ${c.bg} ${c.text} px-2 py-0.5 text-xs font-medium`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}></span>
      {c.label}
    </span>
  );
};

const Card = ({ children, className = "", ...rest }) => (
  <div
    className={`rounded-xl bg-slate-900 border border-slate-700/60 ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const SectionLabel = ({ children, color = "purple" }) => {
  const map = {
    purple: "text-purple-400",
    emerald: "text-emerald-400",
    cyan: "text-cyan-400",
    pink: "text-pink-400",
    amber: "text-amber-400",
  };
  return <div className={`text-[11px] font-mono uppercase tracking-wider ${map[color]}`}>{children}</div>;
};

const Sparkline = ({ data, color = "#a855f7", height = 32 }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((v - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');
  const fillPoints = `0,100 ${points} 100,100`;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={`sparkfill-${color.replace('#','')}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill={`url(#sparkfill-${color.replace('#','')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

// Inline icons (avoid external deps)
const Icon = ({ name, className = "w-4 h-4" }) => {
  const paths = {
    home: <path d="M3 12L12 4l9 8M5 10v10h14V10" />,
    send: <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></>,
    template: <><path d="M4 4h16v6H4z" /><path d="M4 14h7v6H4z" /><path d="M14 14h6v6h-6z" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
    check: <path d="M5 12l5 5L20 7" />,
    x: <path d="M18 6L6 18M6 6l12 12" />,
    chevronRight: <path d="M9 18l6-6-6-6" />,
    chevronLeft: <path d="M15 18l-6-6 6-6" />,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></>,
    refresh: <><path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.7-3L3 16" /><path d="M3 21v-5h5" /><path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.7 3L21 8" /><path d="M21 3v5h-5" /></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></>,
    eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
    alert: <><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0z" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a7 7 0 0 1 14 0v1" /></>,
    play: <path d="M5 3v18l15-9z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    pause: <><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>,
    arrowRight: <><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></>,
    filter: <path d="M22 3H2l8 9.5V19l4 2v-8.5z" />,
    db: <><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14a9 3 0 0 0 18 0V5" /><path d="M3 12a9 3 0 0 0 18 0" /></>,
    mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M2 7l10 6 10-6" /></>,
    fax: <><path d="M6 9V2h12v7" /><rect x="2" y="9" width="20" height="11" rx="2" /><circle cx="18" cy="14" r="1" /></>,
    chat: <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" />,
    sparkles: <><path d="M12 3l1.9 5.8L20 11l-6.1 1.9L12 19l-1.9-6.1L4 11l6.1-2.2z" /><path d="M5 3v4M19 17v4M3 5h4M17 19h4" /></>,
    shieldCheck: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></>,
    chart: <><path d="M3 3v18h18" /><path d="M7 14l4-4 4 4 5-5" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
    user2: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a7 7 0 0 1 14 0v1" /></>,
    activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  };
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {paths[name] || null}
    </svg>
  );
};

Object.assign(window, { fmt, pad, ChannelBadge, StatusPill, Card, SectionLabel, Sparkline, Icon });
