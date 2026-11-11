// Proxies chat messages to the Python AI service (AI_Modal, FastAPI on port 8000).
// The AI service does intent detection (our trained spaCy model), MongoDB search
// and the natural-language reply; this controller only validates and forwards.

const AI_MODAL_URL = (process.env.AI_MODAL_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
const AI_TIMEOUT_MS = Number(process.env.AI_MODAL_TIMEOUT_MS) || 20000;
const MAX_MESSAGE_LENGTH = 1000;

const friendlyError = (reply) => ({
  success: false,
  reply,
  properties: [],
  intent: 'error',
  entities: {},
});

export const handlemessage = async (req, res) => {
  const body = req.body || {};
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const rawSession = body.session_id ?? body.sessionId;
  const sessionId = (typeof rawSession === 'string' && rawSession.trim())
    ? rawSession.trim().slice(0, 200)
    : 'default-session';
  // optional: the listing the user is currently viewing (24-hex ObjectId), forwarded for context
  const rawPropertyId = typeof body.property_id === 'string' ? body.property_id.trim() : (typeof body.propertyId === 'string' ? body.propertyId.trim() : '');
  const propertyId = /^[a-f0-9]{24}$/i.test(rawPropertyId) ? rawPropertyId : null;

  if (!message) {
    return res.status(400).json(friendlyError('Please type a message.'));
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json(
      friendlyError(`Your message is too long. Please keep it under ${MAX_MESSAGE_LENGTH} characters.`),
    );
  }

  try {
    const response = await fetch(`${AI_MODAL_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, session_id: sessionId, ...(propertyId ? { property_id: propertyId } : {}) }),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok || !data || typeof data.reply !== 'string') {
      console.error(`Chatbot AI service responded with status ${response.status}`);
      return res.status(502).json(
        friendlyError((data && data.reply) || 'The assistant had a problem answering. Please try again.'),
      );
    }

    return res.json({
      success: true,
      reply: data.reply,
      properties: Array.isArray(data.properties) ? data.properties : [],
      intent: data.intent || 'unknown',
      entities: data.entities && typeof data.entities === 'object' ? data.entities : {},
      ...(data.travel && typeof data.travel === 'object' ? { travel: data.travel } : {}),
      ...(data.context_property_id ? { context_property_id: String(data.context_property_id) } : {}),
    });
  } catch (error) {
    const timedOut = error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    console.error('Chatbot message handling failed:', timedOut ? 'timeout' : (error && error.message) || error);
    return res.status(timedOut ? 504 : 503).json(
      friendlyError(
        timedOut
          ? 'The assistant is taking too long to respond. Please try again in a moment.'
          : 'The property assistant is offline right now. Please try again later.',
      ),
    );
  }
};
