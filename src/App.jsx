import { useEffect, useRef, useState } from "react";
import LoginPage from "./components/LoginPage";
import Sidebar from "./components/Sidebar";
import ChatPanel from "./components/ChatPanel";
import GraduationChecklist from "./components/GraduationChecklist";
import ThemeToggle from "./components/ThemeToggle";
import { getCatalog, login, signup } from "./services/api";

const HISTORY_STORAGE_PREFIX = "smu-chatbot-conversations";

function loadConversations(userId) {
  try {
    const raw = localStorage.getItem(`${HISTORY_STORAGE_PREFIX}:${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConversations(userId, conversations) {
  try {
    localStorage.setItem(`${HISTORY_STORAGE_PREFIX}:${userId}`, JSON.stringify(conversations));
  } catch {
    // 저장 공간이 없거나 접근이 제한된 경우 조용히 무시합니다.
  }
}

function deriveTitle(messages) {
  const firstUserMessage = messages.find((message) => message.role === "user");
  if (!firstUserMessage) return "새로운 대화";
  const text = firstUserMessage.text.replace(/^🔍\s*/, "");
  return text.length > 28 ? `${text.slice(0, 28)}…` : text;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [catalog, setCatalog] = useState({ tags: [], departments: [] });
  const [filters, setFilters] = useState({ department: null, major: null, tags: [] });
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(() => crypto.randomUUID());
  const [conversations, setConversations] = useState([]);
  const justLoadedRef = useRef(false);

  useEffect(() => {
    getCatalog().then(setCatalog).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    const loaded = loadConversations(user.id);
    justLoadedRef.current = true;
    setConversations(loaded);
    if (loaded.length) {
      setConversationId(loaded[0].id);
      setMessages(loaded[0].messages);
    } else {
      setConversationId(crypto.randomUUID());
      setMessages([]);
    }
  }, [user?.id]);

  useEffect(() => {
    if (justLoadedRef.current) {
      justLoadedRef.current = false;
      return;
    }
    if (!user || !messages.length) return;
    setConversations((current) => {
      const entry = {
        id: conversationId,
        title: deriveTitle(messages),
        messages,
        updatedAt: Date.now(),
      };
      const existingIndex = current.findIndex((item) => item.id === conversationId);
      const next = existingIndex >= 0 ? [...current] : [entry, ...current];
      if (existingIndex >= 0) next[existingIndex] = entry;
      next.sort((a, b) => b.updatedAt - a.updatedAt);
      saveConversations(user.id, next);
      return next;
    });
  }, [messages, conversationId, user]);

  const startNewConversation = () => {
    setConversationId(crypto.randomUUID());
    setMessages([]);
  };

  const selectConversation = (id) => {
    const target = conversations.find((item) => item.id === id);
    if (!target) return;
    setConversationId(id);
    setMessages(target.messages);
  };

  const deleteConversation = (id) => {
    setConversations((current) => {
      const next = current.filter((item) => item.id !== id);
      saveConversations(user.id, next);
      return next;
    });
    if (id === conversationId) startNewConversation();
  };

  const handleSearchResult = (query, results) => {
    setMessages((current) => [
      ...current,
      { role: "user", text: `🔍 ${query}` },
      {
        role: "assistant",
        text: results.length ? `"${query}" 검색 결과 ${results.length}건이에요.` : `"${query}"에 대한 검색 결과가 없어요.`,
        citations: results,
      },
    ]);
  };

  if (!user) {
    return (
      <>
        <ThemeToggle />
        <LoginPage
          onLogin={async (credentials) => setUser(await login(credentials))}
          onSignup={async (details) => signup(details)}
        />
      </>
    );
  }

  return (
    <>
      <ThemeToggle />
      <div className="app-shell">
        <Sidebar
          user={user}
          catalog={catalog}
          filters={filters}
          onFiltersChange={setFilters}
          onLogout={() => setUser(null)}
          onSearchResult={handleSearchResult}
          conversations={conversations}
          activeConversationId={conversationId}
          onNewConversation={startNewConversation}
          onSelectConversation={selectConversation}
          onDeleteConversation={deleteConversation}
        />
        <ChatPanel
          filters={filters}
          messages={messages}
          setMessages={setMessages}
          conversationId={conversationId}
          setConversationId={setConversationId}
          onReset={startNewConversation}
        />
        <GraduationChecklist />
      </div>
    </>
  );
}
