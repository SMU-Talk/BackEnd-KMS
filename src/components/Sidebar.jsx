import { useState } from "react";
import NoticeSearch from "./NoticeSearch";

function MajorEntry({ item }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!item.children) {
    return (
      <a className="major-link" href={item.url} target="_blank" rel="noopener noreferrer">
        • {item.name} <span className="external-icon">↗</span>
      </a>
    );
  }

  return (
    <div className="major-group">
      <button className="major-group-button" onClick={() => setIsOpen(!isOpen)}>
        {item.name}<span>{item.children.length}⌄</span>
      </button>
      {isOpen && (
        <div className="major-sublist">
          {item.children.map((child) => (
            <a className="major-link" key={child.name} href={child.url} target="_blank" rel="noopener noreferrer">
              • {child.name} <span className="external-icon">↗</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ user, catalog, filters, onFiltersChange, onLogout, onSearchResult }) {
  const [openDepartment, setOpenDepartment] = useState(null);

  const toggleTag = (tag) => {
    const tags = filters.tags.includes(tag)
      ? filters.tags.filter((item) => item !== tag)
      : [...filters.tags, tag];
    onFiltersChange({ ...filters, tags });
  };

  return (
    <aside className="sidebar">
      <header className="sidebar-header"><span className="brand-mark">🎓</span><b>Uni<span>Notice</span> AI</b></header>
      <div className="sidebar-content">
        <NoticeSearch onResult={onSearchResult} />
        <section><h2>공지 태그 필터</h2><div className="tag-list">{catalog.tags.map((tag) => <button className={filters.tags.includes(tag) ? "tag active" : "tag"} key={tag} onClick={() => toggleTag(tag)}>{tag}</button>)}</div></section>
        <section><h2>단과대 / 학과 홈페이지</h2>{catalog.departments.map((department) => {
          const isOpen = openDepartment === department.name;
          return <div className="department" key={department.name}>
            <button className="department-button" onClick={() => setOpenDepartment(isOpen ? null : department.name)}>{department.name}<span>{department.majors.length}⌄</span></button>
            {isOpen && <div className="major-list">{department.majors.map((item) => <MajorEntry item={item} key={item.name} />)}</div>}
          </div>;
        })}</section>
      </div>
      <footer className="user-footer"><span className="avatar">{user.name[0]}</span><div><b>{user.name}</b><small>로컬 개발 모드</small></div><button onClick={onLogout} aria-label="로그아웃">⇥</button></footer>
    </aside>
  );
}
