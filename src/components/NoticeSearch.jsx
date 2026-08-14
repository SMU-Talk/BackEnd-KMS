import { useState } from "react";
import { searchNotices } from "../services/api";

export default function NoticeSearch({ onResult }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    try {
      const data = await searchNotices(trimmed);
      onResult?.(trimmed, data.results || []);
      setQuery("");
    } catch {
      onResult?.(trimmed, []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="notice-search">
      <h2>통합검색</h2>
      <form onSubmit={submit}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="공지 제목 키워드 검색"
        />
        <button type="submit" aria-label="검색" disabled={loading}>{loading ? "…" : "🔍"}</button>
      </form>
      <p className="notice-search-status">결과는 채팅창에 표시돼요.</p>
    </section>
  );
}
