import { useState } from "react";
import NoticeSearch from "./NoticeSearch";

function MajorEntry({ item }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!item.children) {
    return (
      <a
        className="major-link"
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        • {item.name} <span className="external-icon">↗</span>
      </a>
    );
  }

  return (
    <div className="major-group">
      <button className="major-group-button" onClick={() => setIsOpen(!isOpen)}>
        {item.name}
        <span>{item.children.length}⌄</span>
      </button>
      {isOpen && (
        <div className="major-sublist">
          {item.children.map((child) => (
            <a
              className="major-link"
              key={child.name}
              href={child.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              • {child.name} <span className="external-icon">↗</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({
  user,
  catalog,
  onLogout,
  onSearchResult,
  conversations,
  activeConversationId,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
}) {
  const [openDepartment, setOpenDepartment] = useState(null);

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <span className="brand-mark">🏫</span>
        <b>
          SMU<span>ChatBot</span>
        </b>
      </header>
      <div className="sidebar-content">
        <section className="history-section">
          <button className="new-chat-button" onClick={onNewConversation}>
            + 새 대화
          </button>
          <h2>대화 기록</h2>
          <div className="history-list">
            {!conversations.length && <p className="history-empty">아직 대화 기록이 없어요.</p>}
            {conversations.map((conversation) => (
              <div
                className={`history-item ${conversation.id === activeConversationId ? "active" : ""}`}
                key={conversation.id}
              >
                <button className="history-item-button" onClick={() => onSelectConversation(conversation.id)}>
                  {conversation.title}
                </button>
                <button
                  className="history-item-delete"
                  aria-label="대화 삭제"
                  onClick={() => onDeleteConversation(conversation.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </section>

        <NoticeSearch onResult={onSearchResult} />

        <section>
          <h2>단과대 / 학과 홈페이지</h2>
          {catalog.departments.map((department) => {
            const isOpen = openDepartment === department.name;
            return (
              <div className="department" key={department.name}>
                <button
                  className="department-button"
                  onClick={() =>
                    setOpenDepartment(isOpen ? null : department.name)
                  }
                >
                  {department.name}
                  <span>{department.majors.length}⌄</span>
                </button>
                {isOpen && (
                  <div className="major-list">
                    {department.majors.map((item) => (
                      <MajorEntry item={item} key={item.name} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </div>
      <footer className="user-footer">
        <span className="avatar">{user.name[0]}</span>
        <div>
          <b>{user.name}</b>
          <small>{user.id}</small>
        </div>
        <button onClick={onLogout} aria-label="로그아웃">
          ⇥
        </button>
      </footer>
    </aside>
  );
}
