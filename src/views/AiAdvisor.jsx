import React, { useState, useRef, useEffect } from 'react';
import { useFinanceStore } from '../store/useFinanceStore';
import { useShallow } from 'zustand/react/shallow';
import { useOverviewMetrics } from '../hooks/computed/useOverviewMetrics';
import { usePensionProjection } from '../hooks/computed/usePensionProjection';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import { extractUserProfile } from '../services/userProfileService';
import { geminiService } from '../services/geminiService';

export default function AiAdvisor() {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Sono il tuo Family Officer privato. Chiedimi qualsiasi analisi sul tuo patrimonio, ottimizzazione del cash flow o piani per raggiungere il FIRE.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // 1. Estrazione selettiva e atomica dell'intero ecosistema finanziario
  const storeData = useFinanceStore(useShallow(state => state.data || {}));
  const computed = useOverviewMetrics();
  const { realCurrentBalance: tfrAdOggi } = usePensionProjection();

  // 2. Inizializza o aggiorna l'agente ogni volta che cambiano i dati
  useEffect(() => {
    const profile = extractUserProfile(storeData, computed, tfrAdOggi);
    geminiService.initialize(profile);
  }, [storeData, computed, tfrAdOggi]);

  // Autoscroll della chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      // 3. Chiamata al servizio frontend che gestisce la logica proxy e l'history
      const reply = await geminiService.sendMessage(userMessage);
      setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
    } catch (error) {
      console.error('Errore durante la chiamata all’Advisor:', error);
      setMessages(prev => [...prev, { role: 'assistant', text: 'Errore di connessione. Verifica la configurazione della tua API Key o la disponibilità del servizio.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col bg-transparent" style={{ height: 'calc(100vh - 140px)' }}>
      {/* Header dell'Agente */}
      <div style={{ padding: '1.25rem', backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ padding: '0.5rem', backgroundColor: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', borderRadius: 'var(--radius-md)' }}>
            <Bot size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, lineHeight: 1.2 }}>AI Wealth Advisor</h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
              <span style={{ width: '6px', height: '6px', backgroundColor: 'var(--status-green)', borderRadius: '50%' }}></span>
              Family Officer connesso al tuo profilo
            </p>
          </div>
        </div>
        <div style={{ fontSize: '0.7rem', backgroundColor: 'var(--bg-tertiary)', padding: '0.25rem 0.75rem', borderRadius: '999px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
          <Sparkles size={12} style={{ color: 'var(--status-yellow)' }} /> Contesto Patrimoniale Attivo
        </div>
      </div>

      {/* Area Messaggi (WhatsApp Style) */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', backgroundColor: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ display: 'flex', gap: '0.75rem', maxWidth: '85%', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
              <div style={{
                padding: '0.5rem', borderRadius: 'var(--radius-md)', height: '32px', width: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                backgroundColor: msg.role === 'user' ? '#3b82f6' : '#8b5cf6', color: 'white'
              }}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div style={{
                padding: '0.85rem 1rem', borderRadius: 'var(--radius-lg)', fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap',
                backgroundColor: msg.role === 'user' ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-primary)',
                color: msg.role === 'user' ? 'var(--text-primary)' : 'var(--text-primary)',
                border: `1px solid ${msg.role === 'user' ? 'rgba(59, 130, 246, 0.3)' : 'var(--border-color)'}`
              }}>
                {msg.text}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-primary)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                <div style={{ width: '6px', height: '6px', backgroundColor: '#8b5cf6', borderRadius: '50%', animation: 'pulse 1s infinite' }}></div>
                <div style={{ width: '6px', height: '6px', backgroundColor: '#8b5cf6', borderRadius: '50%', animation: 'pulse 1s infinite', animationDelay: '0.2s' }}></div>
                <div style={{ width: '6px', height: '6px', backgroundColor: '#8b5cf6', borderRadius: '50%', animation: 'pulse 1s infinite', animationDelay: '0.4s' }}></div>
              </div>
              <span>Analisi patrimoniale in corso...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Form di Input */}
      <form onSubmit={handleSendMessage} style={{ padding: '1rem', backgroundColor: 'var(--bg-primary)', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '0.5rem', borderRadius: '0 0 var(--radius-lg) var(--radius-lg)' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Chiedi un audit o un consiglio sull'allocazione della liquidità..."
          style={{ flex: 1, backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', fontSize: '0.9rem', color: 'var(--text-primary)', outline: 'none' }}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 1.25rem', backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' }}
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
