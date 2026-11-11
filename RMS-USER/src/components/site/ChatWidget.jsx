import { Fragment, useEffect, useRef, useState } from 'react';
import { Link, useMatch } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LuBath, LuBedDouble, LuCar, LuHouse, LuMessageCircle, LuRefreshCw, LuSend, LuSparkles, LuX } from 'react-icons/lu';
import { fetchAllProperties } from '../../hooks/useProperties';
import { getPropertyById } from '../../services/propertyService';
import { resolveImageUrl } from '../../utils/imageUrl';
import { formatArea, formatNumber, formatPKR } from '../../utils/property';
import './ChatWidget.css';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const SESSION_KEY = 'rms_chat_session_id';
const HISTORY_KEY = 'rms_chat_history';

const STARTERS = [
  'Houses for rent near LUMS under 2 lakh',
  'Furnished apartment in Gulberg',
  'Cheapest flats in Johar Town',
  'How do I apply to rent a property?',
];
const PROPERTY_STARTERS = ['How far is this from LUMS?', "What's nearby?", 'Is it furnished?'];

/** Title of the property the user is looking at (cached list first, then a direct lookup). */
function usePropertyTitle(id) {
  const [state, setState] = useState({ id: '', title: '' });
  useEffect(() => {
    if (!id) return undefined;
    let active = true;
    (async () => {
      let title = '';
      try { title = (await fetchAllProperties()).find((x) => x.id === id)?.title || ''; } catch { /* ignore */ }
      if (!title) {
        const res = await getPropertyById(id);
        const raw = res?.data && !Array.isArray(res.data) ? res.data : res;
        title = raw?.title || '';
      }
      if (active) setState({ id, title: title || 'this property' });
    })();
    return () => { active = false; };
  }, [id]);
  return state.id === id ? state.title : '';
}

function TravelSummary({ travel }) {
  const modes = Array.isArray(travel?.modes) ? travel.modes.slice(0, 4) : [];
  if (!modes.length) return null;
  const name = (x) => (x && typeof x === 'object' ? x.name || x.title : x) || '';
  return (
    <div className="rc-travel">
      <strong><LuCar size={13} /> {name(travel.from) ? `${name(travel.from)} → ` : ''}{name(travel.to) || 'Trip'}{travel.distanceKm ? ` · ${Number(travel.distanceKm).toFixed(1)} km` : ''}</strong>
      <ul>{modes.map((m) => <li key={m.mode}>{m.label || m.mode}: ~{m.minutes} min{m.minutesPeak ? ` (${m.minutesPeak} peak)` : ''}{m.costPkr ? ` · PKR ${formatNumber(m.costPkr)}` : ''}</li>)}</ul>
      <span>Estimate</span>
    </div>
  );
}

const WELCOME = {
  role: 'bot',
  text: "Hi! I'm the RMS assistant. Tell me what you're looking for — area, budget, bedrooms — and I'll find matching homes from our live listings.",
};

function getSessionId() {
  const make = () => (globalThis.crypto?.randomUUID?.() || `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
  try {
    let id = window.localStorage.getItem(SESSION_KEY);
    if (!id) { id = make(); window.localStorage.setItem(SESSION_KEY, id); }
    return id;
  } catch {
    return make();
  }
}

function loadHistory() {
  try {
    const raw = window.sessionStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) && parsed.length ? parsed : [WELCOME];
  } catch {
    return [WELCOME];
  }
}

/* --- tiny, safe markdown renderer: **bold**, *italic*, `code`, lists, line breaks --- */
function renderInline(text, keyBase) {
  const parts = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;
  let last = 0; let m; let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${keyBase}-${i += 1}`;
    if (tok.startsWith('**')) parts.push(<strong key={k}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('`')) parts.push(<code key={k}>{tok.slice(1, -1)}</code>);
    else parts.push(<em key={k}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function Markdown({ text = '' }) {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let list = null;
  const flush = () => { if (list) { blocks.push(list); list = null; } };
  lines.forEach((line) => {
    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      const type = ul ? 'ul' : 'ol';
      if (!list || list.type !== type) { flush(); list = { type, items: [], start: ol ? parseInt(line, 10) || 1 : 1 }; }
      list.items.push((ul || ol)[1].trim());
      return;
    }
    // Indented line right after a list item continues that item.
    if (list && /^\s{2,}\S/.test(line)) {
      list.items[list.items.length - 1] += `\n${line.trim()}`;
      return;
    }
    if (list && !line.trim()) return;
    flush();
    blocks.push({ type: line.trim() ? 'p' : 'br', text: line.replace(/^#+\s*/, '') });
  });
  flush();
  return (
    <div className="rc-md">
      {blocks.map((b, idx) => {
        if (b.type === 'ul' || b.type === 'ol') {
          const Tag = b.type;
          return (
            <Tag key={idx} start={b.type === 'ol' && b.start !== 1 ? b.start : undefined}>
              {b.items.map((it, j) => (
                <li key={j}>{it.split('\n').map((part, k) => <Fragment key={k}>{k ? <br /> : null}{renderInline(part, `${idx}-${j}-${k}`)}</Fragment>)}</li>
              ))}
            </Tag>
          );
        }
        if (b.type === 'br') return <Fragment key={idx} />;
        return <p key={idx}>{renderInline(b.text, String(idx))}</p>;
      })}
    </div>
  );
}

function ChatPropertyCard({ p }) {
  const id = p._id || p.id;
  const isRent = !/sale|sell|buy/i.test(String(p.purpose || ''));
  const amount = Number(isRent ? (p.rent || p.price) : (p.price || p.rent)) || 0;
  const img = p.image && !/^data:image\/svg/i.test(p.image) ? resolveImageUrl(p.image) : '';
  const area = formatArea(p.area, p.areaUnit);
  const where = [p.location || p.society, p.city].filter(Boolean).join(', ');
  if (!id) return null;
  return (
    <Link to={`/properties/${id}`} className="rc-prop">
      <div className="rc-prop__img">{img ? <img src={img} alt="" loading="lazy" /> : <span>{p.propertyType || 'Home'}</span>}</div>
      <div className="rc-prop__body">
        <strong>{amount ? (isRent ? `PKR ${formatNumber(amount)}/mo` : formatPKR(amount)) : 'Price on request'}</strong>
        <span className="rc-prop__title">{p.title || `${p.propertyType || 'Property'} in ${where}`}</span>
        <span className="rc-prop__meta">
          {p.bedrooms ? <><LuBedDouble size={12} /> {p.bedrooms}</> : null}
          {p.bathrooms ? <><LuBath size={12} /> {p.bathrooms}</> : null}
          {area.label ? <> · {area.label}</> : null}
        </span>
        {Number(p.distanceKm) > 0 ? (
          <span className="rc-prop__near"><LuCar size={12} /> {Number(p.distanceKm).toFixed(1)} km{Number(p.travelMinutes) > 0 ? ` · ~${Math.round(p.travelMinutes)} min` : ''}</span>
        ) : null}
      </div>
    </Link>
  );
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(loadHistory);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const logRef = useRef(null);
  const inputRef = useRef(null);
  const sessionRef = useRef('');
  const match = useMatch('/properties/:id');
  const propId = match?.params?.id || '';
  const propTitle = usePropertyTitle(propId);
  const [dismissedId, setDismissedId] = useState('');
  const ctxId = propId && dismissedId !== propId ? propId : '';

  useEffect(() => {
    try { window.sessionStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-40))); } catch { /* storage unavailable */ }
    const el = logRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, busy, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 250);
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const send = async (raw) => {
    const text = String(raw ?? input).trim();
    if (!text || busy) return;
    if (!sessionRef.current) sessionRef.current = getSessionId();
    setInput('');
    setMessages((m) => [...m, { role: 'user', text }]);
    setBusy(true);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45000);
      const res = await fetch(`${API_BASE}/chatbot/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, session_id: sessionRef.current, ...(ctxId ? { property_id: ctxId } : {}) }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.reply !== 'string') throw new Error(data?.message || `HTTP ${res.status}`);
      setMessages((m) => [...m, { role: 'bot', text: data.reply, properties: Array.isArray(data.properties) ? data.properties.slice(0, 6) : [], travel: data.travel && typeof data.travel === 'object' ? data.travel : null }]);
    } catch {
      setMessages((m) => [...m, { role: 'bot', error: true, retry: text, text: "Sorry — the assistant isn't available right now. You can still browse all listings or contact our leasing team." }]);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => setMessages([WELCOME]);
  const showStarters = messages.length <= 1 && !busy;
  const starters = ctxId ? PROPERTY_STARTERS : STARTERS;

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.section
            className="rc-panel"
            role="dialog"
            aria-label="RMS assistant chat"
            data-lenis-prevent
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="rc-head">
              <div className="rc-head__avatar"><LuSparkles size={18} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>RMS Assistant</strong>
                <span><i className="rc-online" /> Searches live listings for you</span>
              </div>
              <button type="button" className="rc-iconbtn" onClick={reset} aria-label="Start a new conversation" title="New conversation"><LuRefreshCw size={16} /></button>
              <button type="button" className="rc-iconbtn" onClick={() => setOpen(false)} aria-label="Close chat"><LuX size={18} /></button>
            </header>

            <div className="rc-log" ref={logRef} aria-live="polite">
              {messages.map((m, i) => (
                <motion.div key={i} className={`rc-msg rc-msg--${m.role} ${m.error ? 'is-error' : ''}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                  <div className="rc-bubble">
                    {m.role === 'bot' ? <Markdown text={m.text} /> : m.text}
                    {m.error ? (
                      <div className="rc-error-actions">
                        <button type="button" onClick={() => send(m.retry)}>Try again</button>
                        <Link to="/properties" onClick={() => setOpen(false)}>Browse listings</Link>
                        <Link to="/contact" onClick={() => setOpen(false)}>Contact us</Link>
                      </div>
                    ) : null}
                  </div>
                  {m.travel ? <TravelSummary travel={m.travel} /> : null}
                  {m.properties?.length ? (
                    <div className="rc-props">{m.properties.map((p, j) => <ChatPropertyCard key={p._id || j} p={p} />)}</div>
                  ) : null}
                </motion.div>
              ))}
              {busy && (
                <div className="rc-msg rc-msg--bot"><div className="rc-bubble rc-typing" aria-label="Assistant is typing"><i /><i /><i /></div></div>
              )}
              {showStarters && (
                <div className="rc-starters">
                  {starters.map((s) => <button key={s} type="button" onClick={() => send(s)}>{s}</button>)}
                </div>
              )}
            </div>

            {ctxId ? (
              <div className="rc-ctx">
                <span className="rc-ctx__chip" title={propTitle}>
                  <LuHouse size={13} /> <span>Asking about: <strong>{propTitle || 'this property'}</strong></span>
                  <button type="button" onClick={() => setDismissedId(propId)} aria-label="Stop asking about this property"><LuX size={13} /></button>
                </span>
                {!showStarters && !busy ? (
                  <div className="rc-ctx__sugg">{PROPERTY_STARTERS.map((s) => <button key={s} type="button" onClick={() => send(s)}>{s}</button>)}</div>
                ) : null}
              </div>
            ) : null}
            <form className="rc-form" onSubmit={(e) => { e.preventDefault(); send(); }}>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={ctxId ? 'Ask about this property…' : 'e.g. 2 bed flat in Johar Town'}
                maxLength={500}
                aria-label="Message"
              />
              <button type="submit" disabled={!input.trim() || busy} aria-label="Send"><LuSend size={17} /></button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        className={`rc-fab ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close chat' : 'Chat with the RMS assistant'}
        aria-expanded={open}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={open ? 'x' : 'c'} initial={{ rotate: -45, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 45, opacity: 0 }} transition={{ duration: 0.18 }} style={{ display: 'grid' }}>
            {open ? <LuX size={24} /> : <LuMessageCircle size={24} />}
          </motion.span>
        </AnimatePresence>
        {!open ? <span className="rc-fab__label">Ask RMS</span> : null}
      </motion.button>
    </>
  );
}
