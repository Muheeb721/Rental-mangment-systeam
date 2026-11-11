import express from 'express';
import * as chatBotController from '../controllers/chatbotController.js';

const router = express.Router();

// POST /api/chatbot/message  { message, session_id } -> { reply, properties, intent, entities }
router.post('/message', chatBotController.handlemessage);

export default router;
