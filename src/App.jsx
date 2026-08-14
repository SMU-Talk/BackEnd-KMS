import { useEffect, useState } from "react";
import LoginPage from "./components/LoginPage";
import Sidebar from "./components/Sidebar";
import ChatPanel from "./components/ChatPanel";
import GraduationChecklist from "./components/GraduationChecklist";
import ThemeToggle from "./components/ThemeToggle";
import { getCatalog, login, signup } from "./services/api";

export default function App() {
  const [user, setUser] = useState(null);
  const [catalog, setCatalog] = useState({ tags: [], departments: [] });
  const [filters, setFilters] = useState({ department: null, major: null, tags: [] });
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    getCatalog().then(setCatalog).catch(() => {});
  }, []);

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
        />
        <ChatPanel
          filters={filters}
          messages={messages}
          setMessages={setMessages}
          conversationId={conversationId}
          setConversationId={setConversationId}
        />
        <GraduationChecklist />
      </div>
    </>
  );
}
