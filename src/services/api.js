import { mockCatalog } from "../data/catalog";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
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
