import { useState } from "react";
import { askChat, sendFeedback } from "../services/api";
import CampusMapModal from "./CampusMapModal";

const suggestions = [
  "기숙사 신청 일정 알려줘",
  "국가장학금 학점 기준 알려줘",
  "졸업 요건이 어떻게 돼?",
];

function CitationCards({ citations }) {
  if (!citations?.length) return null;

  return (
    <section className="citations" aria-label="답변 출처">
      <strong>참고한 공지</strong>
      {citations.map((citation, index) => (
        <a
          className="citation-card"
          href={citation.url || "#"}
          key={`${citation.url || citation.title}-${index}`}
          target={citation.url ? "_blank" : undefined}
          rel={citation.url ? "noreferrer" : undefined}
          onClick={(event) => !citation.url && event.preventDefault()}
        >
          <span>{citation.date || "날짜 미상"}</span>
          <b>{citation.title || "학교 공지"}</b>
          {citation.url && <em>원문 보기 ↗</em>}
        </a>
      ))}
    </section>
  );
}

function AnswerFeedback({ messageId, onFeedback }) {
  const [sent, setSent] = useState(null);
  if (!messageId) return null;

  const submit = async (rating) => {
    try {
      await onFeedback(messageId, rating);
      setSent(rating);
    } catch {
      setSent("error");
    }
  };

  return (
    <div className="feedback-row">
      <span>{sent === "error" ? "피드백 저장에 실패했습니다." : sent ? "피드백 감사합니다." : "이 답변이 도움이 되었나요?"}</span>
      {!sent && <><button onClick={() => submit("up")}>👍</button><button onClick={() => submit("down")}>👎</button></>}
    </div>
  );
}

export default function ChatPanel({ filters, messages, setMessages, conversationId, setConversationId, onReset }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const send = async (value = input) => {
    const message = value.trim();
    if (!message || loading) return;

    setMessages((current) => [...current, { role: "user", text: message }]);
    setInput("");
    setLoading(true);

    try {
      const response = await askChat({ message, filters, conversationId });
      setConversationId(response.conversationId || conversationId);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: response.answer,
          citations: response.citations || [],
          messageId: response.messageId,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        { role: "assistant", text: `오류: ${error.message}`, citations: [] },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    if (onReset) {
      onReset();
      return;
    }
    setMessages([]);
    setConversationId(crypto.randomUUID());
  };

  return (
    <main className="chat-panel">
      <header className="chat-header">
        <span>🤖</span>
        <div><b>학과 공지 AI 어시스턴트</b><small>검토된 학교 공지를 검색합니다</small></div>
        <i>● 응답 가능</i>
        <button className="map-button" onClick={() => setShowMap(true)}>🗺️ 학교 맵</button>
        <button onClick={reset}>초기화</button>
      </header>
      <section className="messages" aria-live="polite">
        {!messages.length && <div className="welcome"><strong>🎓</strong><h1>학과 공지 AI에 오신 것을 환영합니다!</h1><p>학교 공지와 규정을 바탕으로 답변하고, 원문 출처를 함께 보여드립니다.</p><div>{suggestions.map((item) => <button key={item} onClick={() => send(item)}>{item}</button>)}</div></div>}
        {messages.map((message, index) => <article className={`message ${message.role}`} key={index}><span>{message.role === "user" ? "U" : "🤖"}</span><div><p>{message.text}</p><CitationCards citations={message.citations} />{message.role === "assistant" && <AnswerFeedback messageId={message.messageId} onFeedback={(messageId, rating) => sendFeedback({ messageId, rating })} />}</div></article>)}
        {loading && <article className="message assistant"><span>🤖</span><div className="typing">답변을 준비하고 있습니다...</div></article>}
      </section>
      <form className="chat-input" onSubmit={(event) => { event.preventDefault(); send(); }}><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder="학교 공지사항에 대해 질문해 보세요!" rows="1" /><button disabled={!input.trim() || loading} aria-label="질문 전송">➤</button></form>
      {showMap && <CampusMapModal onClose={() => setShowMap(false)} />}
    </main>
  );
}
