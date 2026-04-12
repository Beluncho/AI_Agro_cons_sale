import { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  Plus, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  MessageSquare,
  Package,
  Terminal,
  User,
  Bot,
  ChevronRight,
  Sun,
  Moon,
  Settings,
  Database,
  Info,
  Link as LinkIcon
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from './lib/utils';
import { Chunk, Message, LogEntry } from './types';

const SYSTEM_INSTRUCTION = `Ты — AI АгроКонсультант компании ПК «Ярославич».

## Твои знания:
1. Агрономия: регионы РФ, культуры, сроки посева/уборки, погодные условия
2. Техника: ТОЛЬКО из chunks, которые я тебе передам

## ФОРМАТ ОТВЕТА (ОБЯЗАТЕЛЬНО!):
Твой ответ должен быть ТОЛЬКО JSON без лишнего текста:
{"reply": "текст ответа"}

## ПРАВИЛА:
1. Если пользователь спрашивает о технике → используй предоставленные chunks для формирования ответа.
2. Если пользователь спрашивает о регионах/культурах/сроках → отвечай на основе своих знаний агрономии.
3. НЕ ВЫДУМЫВАЙ технику, которой нет в chunks.

## ПРИМЕРЫ:
Вопрос: "трамбовщик ТСМ-3"
Ответ: {"reply": "✅ Трамбовщик ТСМ-3 отлично подходит для уплотнения силоса..."}

Вопрос: "Краснодарский край, пшеница, сроки посева?"
Ответ: {"reply": "🌾 В Краснодарском крае оптимальные сроки посева озимой пшеницы..."}

## ВАЖНО:
- Всегда возвращай ТОЛЬКО JSON.
- Никакого текста вне JSON.
`;

const INITIAL_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content: `🌾 Здравствуйте! Я Агро-Консультант.

Чтобы начать, подключитесь к бэкенду через поле вверху.

**Что я умею:**
• Консультировать по регионам РФ, культурах, сроках посева/уборки
• Рекомендовать технику (только если вы спросите)
• Анализировать погодные условия и климат

*Подсказка: спросите "Какая техника подойдёт для культивации в Краснодарском крае?"*`
};

export default function App() {
  // Theme state
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');

  // Backend state
  const [backendUrl, setBackendUrl] = useState(() => localStorage.getItem('backendUrl') || '');
  const [isConnected, setIsConnected] = useState(false);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [isReady, setIsReady] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('agro_messages');
    return saved ? JSON.parse(saved) : [INITIAL_MESSAGE];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  // UI state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedChunk, setSelectedChunk] = useState<Chunk | null>(null);
  const [statusMessage, setStatusMessage] = useState('Ожидание подключения...');
  const [isLogVisible, setIsLogVisible] = useState(true);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Persist state
  useEffect(() => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDark]);

  useEffect(() => {
    localStorage.setItem('agro_messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('backendUrl', backendUrl);
  }, [backendUrl]);

  // Auto-connect on mount
  useEffect(() => {
    if (backendUrl && !isConnected) {
      handleConnect();
    }
  }, []);

  // Logging helper
  const addLog = (method: string, endpoint: string, type: 'request' | 'response' | 'error' | 'success', data?: any) => {
    setLogs(prev => [{
      timestamp: new Date().toLocaleTimeString(),
      method,
      endpoint,
      type,
      data
    }, ...prev].slice(0, 50));
  };

  // Connection logic
  const handleConnect = async () => {
    const targetUrl = backendUrl || window.location.origin;
    
    // Sanitize URL (remove trailing slash)
    const sanitizedUrl = targetUrl.replace(/\/$/, '');
    
    try {
      setStatusMessage('🔌 Подключение...');
      addLog('GET', '/health', 'request');
      const healthRes = await axios.get(`${sanitizedUrl}/health`);
      addLog('GET', '/health', 'success', healthRes.data);

      if (healthRes.data.status === 'ok') {
        setIsConnected(true);
        setStatusMessage('✅ Связь установлена. Загрузка данных...');
        
        addLog('GET', '/api/chunks', 'request');
        const chunksRes = await axios.get(`${sanitizedUrl}/api/chunks`);
        addLog('GET', '/api/chunks', 'success', chunksRes.data);
        
        setChunks(chunksRes.data.chunks || []);
        setIsReady(true);
        setStatusMessage(`✅ Готово. Загружено ${chunksRes.data.chunks?.length || 0} товаров.`);
        
        // Only add welcome message if it's the first time
        if (messages.length === 1 && messages[0].id === 'welcome') {
          const assistantMsg: Message = {
            id: Date.now().toString(),
            role: 'assistant',
            content: `✅ База данных загружена! Готов консультировать.\n\n🌾 Задавайте вопросы о:\n• регионах РФ и их климате\n• культурах и сроках посева/уборки\n• погодных условиях\n\n🚜 Если нужна техника — просто спросите!`
          };
          setMessages(prev => [...prev, assistantMsg]);
        }
      }
    } catch (error: any) {
      addLog('GET', '/health', 'error', error.message);
      setStatusMessage('❌ Ошибка: ' + error.message);
      setIsConnected(false);
    }
  };

  // Chat actions
  const startOver = () => {
    setMessages([INITIAL_MESSAGE]);
    setSelectedChunk(null);
    localStorage.removeItem('agro_messages');
    setShowConfirmReset(false);
  };

  const copyLogs = () => {
    const logText = logs.map(l => `[${l.timestamp}] ${l.type.toUpperCase()} ${l.method} ${l.endpoint}\n${l.data ? JSON.stringify(l.data, null, 2) : ''}`).join('\n\n');
    navigator.clipboard.writeText(logText);
    alert('Логи скопированы в буфер обмена');
  };

  // AI logic
  const findRelevantChunks = (query: string, allChunks: Chunk[]) => {
    if (!allChunks || allChunks.length === 0) return [];
    
    const lowerQuery = query.toLowerCase();
    const normalizedQuery = lowerQuery
      .replace(/[-]\d+\b/g, '') // Remove suffixes like -3, -4 anywhere in string
      .replace(/тсм/g, 'трамбовщик')
      .replace(/кбм/g, 'культиватор')
      .replace(/пс/g, 'полуприцеп');

    const keywords = normalizedQuery.split(/\s+/).filter(k => k.length > 2);
    const originalKeywords = lowerQuery.split(/\s+/).filter(k => k.length > 2);

    return allChunks.map(chunk => {
      let score = 0;
      const title = chunk.title.toLowerCase();
      const text = chunk.text.toLowerCase();
      const id = chunk.id.toLowerCase();
      const features = JSON.stringify(chunk.features).toLowerCase();

      // Exact ID match or partial ID match
      if (id === lowerQuery || id === normalizedQuery) score += 200;
      if (id.includes(normalizedQuery) || normalizedQuery.includes(id)) score += 100;
      if (id.includes(lowerQuery) || lowerQuery.includes(id)) score += 80;
      
      // Title matches
      if (title.includes(normalizedQuery) || title.includes(lowerQuery)) score += 50;
      
      // Keyword matches
      [...new Set([...keywords, ...originalKeywords])].forEach(word => {
        if (title.includes(word)) score += 20;
        if (text.includes(word)) score += 10;
        if (features.includes(word)) score += 15;
      });

      return { chunk, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10) // Send more context to AI
    .map(item => item.chunk);
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    addLog('AI', 'Gemini', 'request', { message: input });

    try {
      const relevantChunks = findRelevantChunks(input, chunks);
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const model = ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { role: 'user', parts: [{ text: `User: ${input}\n\nContext: ${JSON.stringify(messages.slice(-5))}\n\nMachinery Chunks (Top Relevant): ${JSON.stringify(relevantChunks)}` }] }
        ],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: { type: Type.STRING }
            },
            required: ["reply"]
          }
        }
      });

      const response = await model;
      const data = JSON.parse(response.text || '{}');
      addLog('AI', 'Gemini', 'success', data);

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply
      };

      setMessages(prev => [...prev, assistantMsg]);

      // Simple logic: update showcase based on first relevant chunk found by search
      if (relevantChunks.length > 0) {
        const bestMatch = relevantChunks[0];
        setSelectedChunk(bestMatch);
        addLog('UI', 'Showcase', 'success', { selected: bestMatch.title });
      } else {
        setSelectedChunk(null);
      }

    } catch (error: any) {
      console.error(error);
      addLog('AI', 'Gemini', 'error', error.message);
      const errorMsg: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: '❌ Произошла ошибка при генерации ответа. Проверьте логи.'
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant' && lastMessage.id !== 'welcome') {
        // Scroll to the top of the last assistant message
        const lastMsgElement = document.getElementById(`msg-${lastMessage.id}`);
        if (lastMsgElement) {
          lastMsgElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } else {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-agro-green">
      {/* Header */}
      <header className="bg-agro-blue text-white p-4 flex flex-wrap justify-between items-center gap-4 shadow-lg z-20">
        <div className="logo">
          <h1 className="text-2xl font-bold">🌾 Агро-Консультант</h1>
          <p className="text-xs opacity-90">Чат | Витрина техники | Лог</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <input 
            type="text" 
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
            placeholder="https://...trycloudflare.com"
            className="px-4 py-2 rounded-full text-black text-sm w-64 outline-none focus:ring-2 focus:ring-agro-green-dark"
          />
          <button 
            onClick={handleConnect}
            className="bg-agro-green-dark hover:bg-green-800 text-white px-6 py-2 rounded-full font-bold transition-all transform hover:scale-105"
          >
            🔌 Connect
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Chat Panel (40%) */}
        <div className="w-[40%] flex flex-col border-r-2 border-agro-blue chat-panel shadow-xl">
          <div className="bg-agro-blue text-white p-4 flex justify-between items-center">
            <span className="font-bold">💬 Чат с агрономом</span>
            <button 
              onClick={() => setIsDark(!isDark)}
              className="text-xl hover:scale-110 transition-transform"
            >
              {isDark ? '☀️' : '🌙'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map(msg => (
              <div 
                key={msg.id}
                id={`msg-${msg.id}`}
                className={cn(
                  "max-w-[85%] p-3 rounded-2xl text-sm shadow-sm leading-relaxed chat-text",
                  msg.role === 'user' 
                    ? "user-message self-end rounded-br-none" 
                    : "assistant-message self-start rounded-bl-none"
                )}
              >
                <div className="markdown-body prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
            {!showConfirmReset ? (
              <button 
                onClick={() => setShowConfirmReset(true)}
                className="w-full flex items-center justify-center gap-2 text-xs text-gray-500 hover:text-agro-blue transition-colors py-1 border border-dashed border-gray-300 rounded-lg"
              >
                <RefreshCw className="w-3 h-3" />
                Очистить чат и начать заново
              </button>
            ) : (
              <div className="flex gap-2">
                <button 
                  onClick={startOver}
                  className="flex-1 bg-red-500 text-white text-xs py-1 rounded-lg font-bold hover:bg-red-600 transition-colors"
                >
                  Да, очистить
                </button>
                <button 
                  onClick={() => setShowConfirmReset(false)}
                  className="flex-1 bg-gray-200 text-gray-700 text-xs py-1 rounded-lg font-bold hover:bg-gray-300 transition-colors"
                >
                  Отмена
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <textarea 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                placeholder="Введите ваш вопрос..."
                disabled={!isReady || isLoading}
                rows={2}
                className="flex-1 p-3 border border-agro-blue rounded-2xl resize-none text-sm focus:ring-2 focus:ring-agro-blue outline-none disabled:opacity-50 dark:bg-gray-900"
              />
              <button 
                onClick={handleSendMessage}
                disabled={!isReady || isLoading || !input.trim()}
                className="bg-agro-blue text-white p-3 rounded-full hover:opacity-90 transition-opacity disabled:opacity-50 self-end shadow-lg"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Center Column: Showcase Panel */}
        <div className="flex-1 p-6 overflow-y-auto bg-agro-green/50 relative">
          {!isLogVisible && (
            <button 
              onClick={() => setIsLogVisible(true)}
              className="absolute top-4 right-4 bg-agro-blue text-white p-2 rounded-full shadow-lg hover:scale-110 transition-transform z-10"
              title="Показать логи"
            >
              <Terminal className="w-5 h-5" />
            </button>
          )}
          {selectedChunk ? (
            <motion.div 
              key={selectedChunk.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="product-card rounded-3xl p-6 space-y-6"
            >
              <img 
                src={selectedChunk.image ? `/api/image?url=${encodeURIComponent(selectedChunk.image)}` : 'https://picsum.photos/seed/psp/800/600'} 
                alt={selectedChunk.title}
                className="w-full max-h-[300px] object-contain rounded-2xl shadow-md bg-white"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  const fallback = 'https://picsum.photos/seed/psp/800/600';
                  if (target.src !== fallback) {
                    console.error("Image load error, using PSP fallback for:", selectedChunk.image);
                    target.src = fallback;
                  }
                }}
              />
              <h2 className="text-2xl font-bold text-agro-blue-dark">{selectedChunk.title}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                {selectedChunk.text}
              </p>

              <div className="grid grid-cols-2 gap-4">
                {Object.entries(selectedChunk.features).map(([key, value]) => (
                  <div key={key} className="bg-agro-blue/10 p-3 rounded-xl border border-agro-blue/20">
                    <strong className="block text-[10px] uppercase text-agro-blue-dark mb-1">{key}</strong>
                    <span className="text-sm font-semibold">{value}</span>
                  </div>
                ))}
              </div>

              {selectedChunk.variants && selectedChunk.variants.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold uppercase text-agro-blue-dark">Комплектации</h4>
                  {selectedChunk.variants.map((v, i) => (
                    <div key={i} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                      <div className="font-bold text-sm">{v.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{v.description}</div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 border-4 border-dashed border-gray-200 dark:border-gray-800 rounded-3xl p-10 text-center">
              <Package className="w-20 h-20 mb-4 opacity-20" />
              <h3 className="text-xl font-bold">Витрина техники</h3>
              <p className="text-sm mt-2">Спросите меня о технике, и я покажу её характеристики, картинки и комплектации</p>
            </div>
          )}
        </div>

        {/* Right Column: Log Panel */}
        <AnimatePresence>
          {isLogVisible && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '25%', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 100 }}
              className="bg-[#1e1e1e] text-green-400 font-mono text-[11px] border-l border-gray-800 flex flex-col overflow-hidden"
            >
              <div className="p-4 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800">
                <div className="text-agro-blue font-bold text-sm mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4" />
                    📋 ЛОГ ЗАПРОСОВ
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={copyLogs}
                      className="p-1 hover:bg-gray-800 rounded transition-colors text-gray-400 hover:text-white"
                      title="Копировать логи"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                    </button>
                    <button 
                      onClick={() => setIsLogVisible(false)}
                      className="p-1 hover:bg-gray-800 rounded transition-colors text-gray-400 hover:text-white"
                      title="Скрыть логи"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="text-[9px] text-gray-500 uppercase mb-2">{statusMessage}</div>
                  {logs.map((log, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "p-2 border-l-2 space-y-1",
                        log.type === 'error' ? "border-red-500 text-red-400" : 
                        log.type === 'success' ? "border-green-500 text-green-400" : "border-agro-blue text-agro-blue"
                      )}
                    >
                      <div className="flex justify-between text-[9px]">
                        <span>[{log.timestamp}]</span>
                        <span className="uppercase font-bold">{log.type}</span>
                      </div>
                      <div className="font-bold">{log.method} {log.endpoint}</div>
                      {log.data && (
                        <pre className="mt-1 p-2 bg-black/40 rounded overflow-x-auto text-[9px]">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                  {logs.length === 0 && (
                    <div className="text-gray-700 italic text-center mt-10">Ожидание запросов...</div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <footer className="bg-agro-blue text-white p-3 text-center text-xs shadow-inner">
        📊 Источники: открытые агро-данные РФ (регионы, культуры, сроки, погода) | 🏭 Парсинг сайта: pkyar.ru (техника Ярославич)
      </footer>
    </div>
  );
}
