import { useEffect, useState } from "react";
import LoginPage from "./components/LoginPage";
import Sidebar from "./components/Sidebar";
import ChatPanel from "./components/ChatPanel";
import { getCatalog, login, signup } from "./services/api";

export default function App() {
  const [user, setUser] = useState(null);
  const [catalog, setCatalog] = useState({ tags: [], departments: [] });
  const [filters, setFilters] = useState({ department: null, major: null, tags: [] });

  useEffect(() => {
    getCatalog().then(setCatalog).catch(() => {});
  }, []);

  if (!user) {
    return (
      <LoginPage
        onLogin={async (credentials) => setUser(await login(credentials))}
        onSignup={async (details) => signup(details)}
      />
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        user={user}
        catalog={catalog}
        filters={filters}
        onFiltersChange={setFilters}
        onLogout={() => setUser(null)}
      />
      <ChatPanel filters={filters} />
    </div>
  );
}
