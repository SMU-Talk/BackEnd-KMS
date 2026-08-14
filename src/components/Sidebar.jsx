import { useState } from "react";

export default function Sidebar({ user, catalog, filters, onFiltersChange, onLogout }) {
  const [openDepartment, setOpenDepartment] = useState(null);

  const toggleTag = (tag) => {
    const tags = filters.tags.includes(tag)
      ? filters.tags.filter((item) => item !== tag)
      : [...filters.tags, tag];
    onFiltersChange({ ...filters, tags });
  };

  const selectMajor = (department, major) => {
    const isSelected = filters.major === major;
    onFiltersChange({
      ...filters,
      department: isSelected ? null : department,
      major: isSelected ? null : major,
    });
  };

  return (
    <aside className="sidebar">
      <header className="sidebar-header"><span className="brand-mark">🎓</span><b>Uni<span>Notice</span> AI</b></header>
      <div className="sidebar-content">
        <section><h2>공지 태그 필터</h2><div className="tag-list">{catalog.tags.map((tag) => <button className={filters.tags.includes(tag) ? "tag active" : "tag"} key={tag} onClick={() => toggleTag(tag)}>{tag}</button>)}</div></section>
        <section><h2>단과대 / 학과 선택</h2>{catalog.departments.map((department) => {
          const isOpen = openDepartment === department.name;
          return <div className="department" key={department.name}>
            <button className="department-button" onClick={() => setOpenDepartment(isOpen ? null : department.name)}>{department.name}<span>{department.majors.length}⌄</span></button>
            {isOpen && <div className="major-list">{department.majors.map((item) => <button className={filters.major === item ? "major active" : "major"} key={item} onClick={() => selectMajor(department.name, item)}>• {item}</button>)}</div>}
          </div>;
        })}</section>
      </div>
      <footer className="user-footer"><span className="avatar">{user.name[0]}</span><div><b>{user.name}</b><small>로컬 개발 모드</small></div><button onClick={onLogout} aria-label="로그아웃">⇥</button></footer>
    </aside>
  );
}
