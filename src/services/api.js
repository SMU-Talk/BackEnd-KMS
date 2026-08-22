import { mockCatalog } from "../data/catalog";
import { GRAD_STATE_STORAGE_KEY } from "../data/graduationRules.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";
const TOKEN_STORAGE_KEY = "smu-talk-token";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let authToken = typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;

export function setAuthToken(token) {
  authToken = token;
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

// 로그아웃하면 서버에 저장된 학점도 지웁니다. 다음에 로그인해도 통합정보시스템에서
// 다시 가져오기 전까지는 졸업요건이 보이지 않습니다.
export async function logout() {
  if (!USE_MOCK && authToken) {
    try {
      await request("/logout", { method: "POST" });
    } catch {
      // 서버가 응답하지 않아도 이 브라우저의 토큰과 입력값은 반드시 지웁니다.
    }
  }
  setAuthToken(null);
  localStorage.removeItem(GRAD_STATE_STORAGE_KEY);
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...options.headers,
    },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.detail || body.message || "요청을 처리하지 못했습니다.");
  }
  return body;
}

export async function login({ studentId, password }) {
  if (USE_MOCK) {
    await wait(250);
    if (!studentId || !password) throw new Error("학번과 비밀번호를 입력해 주세요.");
    return { id: studentId, name: `${studentId}님` };
  }

  const data = await request("/login", {
    method: "POST",
    body: JSON.stringify({ id: studentId, password }),
  });
  setAuthToken(data.token);
  return { id: data.user.id, name: data.user.nickname || data.user.id };
}

export async function signup({ studentId, nickname, password }) {
  if (USE_MOCK) {
    await wait(250);
    if (!studentId || !nickname || !password) throw new Error("모든 항목을 입력해 주세요.");
    return { id: studentId, name: nickname };
  }

  const data = await request("/signup", {
    method: "POST",
    body: JSON.stringify({ id: studentId, nickname, password }),
  });
  setAuthToken(data.token);
  return { id: data.user.id, name: data.user.nickname || data.user.id };
}

export async function getCatalog() {
  if (USE_MOCK) return mockCatalog;

  const data = await request("/filters");
  return {
    tags: data.tags || mockCatalog.tags,
    departments: mockCatalog.departments.map((department) => ({
      ...department,
      name: data.departments?.find((name) => name === department.name) || department.name,
    })),
  };
}

export async function askChat({ message, filters, conversationId }) {
  if (USE_MOCK) {
    await wait(700);
    return {
      answer: `목 데이터 모드입니다.\n\n“${message}” 질문을 ${filters.major || filters.department || "전체 공지"} 기준으로 백엔드에 전달할 준비가 되어 있습니다.`,
      citations: [],
      messageId: `mock-${Date.now()}`,
      conversationId,
    };
  }

  return request("/chat", {
    method: "POST",
    body: JSON.stringify({
      prompt: message,
      department: filters.major || filters.department,
      tag: filters.tags,
      conversation_id: conversationId,
    }),
  });
}

export async function sendFeedback({ messageId, rating }) {
  if (USE_MOCK) return { success: true };
  return request("/feedback", {
    method: "POST",
    body: JSON.stringify({ message_id: messageId, rating }),
  });
}

export async function searchNotices(query) {
  if (USE_MOCK) {
    await wait(200);
    return { results: [] };
  }
  const params = new URLSearchParams({ q: query });
  return request(`/search?${params.toString()}`);
}

export async function getLinkCode() {
  if (USE_MOCK) {
    await wait(200);
    return { code: "MOCK1234", expiresInSeconds: 300 };
  }
  return request("/integrations/link-code", { method: "POST" });
}

export async function getGrades() {
  if (USE_MOCK) {
    await wait(200);
    return { summary: null, semesters: [], syncedAt: null };
  }
  return request("/grades");
}

export async function syncGradesFromPortal({ studentId, studentName, password }) {
  if (USE_MOCK) {
    await wait(600);
    return { success: true, semestersSynced: 0, subjectsSynced: 0 };
  }
  return request("/grades/sync", {
    method: "POST",
    body: JSON.stringify({ studentId, studentName, password }),
  });
}

export async function getExamPapers() {
  if (USE_MOCK) {
    await wait(200);
    return { papers: [] };
  }
  return request("/exams");
}

export async function syncExamPapers({ studentId, password, schYear, semester, subjectName, examDiv }) {
  if (USE_MOCK) {
    await wait(600);
    return { success: true, papersSynced: 0 };
  }
  return request("/exams/sync", {
    method: "POST",
    body: JSON.stringify({ studentId, password, schYear, semester, subjectName, examDiv }),
  });
}

/** 첨부파일을 받아 브라우저 다운로드를 실행하고 저장된 파일명을 반환합니다.
 *
 * 조회할 때 서버가 파일을 받아 두므로 보통은 자격증명이 필요 없습니다. 저장된
 * 사본이 없을 때만 서버가 409로 알려 주고, 그때 studentId/password가 쓰입니다.
 */
export async function downloadExamAttachment({ attachmentId, fileName, studentId, password }) {
  if (USE_MOCK) {
    await wait(400);
    return fileName;
  }

  // 이 응답만 JSON이 아니라 파일 바이트라서 request()를 쓰지 않습니다.
  const response = await fetch(`${API_BASE_URL}/exams/attachments/${attachmentId}/download`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({ studentId, password }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || "첨부파일을 내려받지 못했습니다.");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName || "첨부파일";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // 즉시 해제하면 저장이 시작되기 전에 blob이 사라지는 브라우저가 있습니다.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return link.download;
}

export async function parseGradesPreview(rawText) {
  if (USE_MOCK) {
    await wait(200);
    return { summary: {}, semesters: [] };
  }
  return request("/grades/parse-preview", {
    method: "POST",
    body: JSON.stringify({ rawText }),
  });
}

export async function importGrades({ summary, semesters }) {
  if (USE_MOCK) {
    await wait(200);
    return { success: true, semestersSynced: semesters.length, subjectsSynced: 0 };
  }
  return request("/grades/import", {
    method: "POST",
    body: JSON.stringify({ summary, semesters }),
  });
}
