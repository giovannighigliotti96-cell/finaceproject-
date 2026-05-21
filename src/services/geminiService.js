import { buildSystemPrompt } from '../config/familyOfficerAgent';

class GeminiService {
  constructor() {
    this.systemInstruction = '';
    this.chatHistory = [];
  }

  initialize(userProfile) {
    this.systemInstruction = buildSystemPrompt(userProfile);
    // Don't reset history entirely on every render update, just update the instruction
    // The history shouldn't clear unless explicitly requested
  }

  clearHistory() {
    this.chatHistory = [];
  }

  async sendMessage(message) {
    // Add user message to local history for context payload
    const currentMessage = { role: 'user', parts: [{ text: message }] };
    const payloadContents = [...this.chatHistory, currentMessage];

    const response = await fetch('/api/chat-advisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: this.systemInstruction,
        contents: payloadContents
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data?.error || 'Errore dal backend AI');
    }

    const reply = data.reply;
    
    // Save successful transaction to local history
    this.chatHistory.push(currentMessage);
    this.chatHistory.push({ role: 'model', parts: [{ text: reply }] });

    return reply;
  }
}

// Export a singleton instance
export const geminiService = new GeminiService();
