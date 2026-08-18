// 이 서비스 워커만 SMU-Talk 백엔드와 통신합니다.
// content.js는 smul.smu.ac.kr만 이야기하므로, 세션 쿠키와 SMU-Talk 토큰이
// 같은 코드 안에서 만나지 않습니다.

importScripts("config.js");

const STORAGE_KEYS = {
  token: "smuTalkToken",
  user: "smuTalkUser",
  lastSyncedAt: "smuTalkLastSyncedAt",
};

async function getSmulTab() {
  const tabs = await chrome.tabs.query({ url: `${SMUL_ORIGIN}/*` });
  return tabs[0] || null;
}

async function handleLink(code) {
  const response = await fetch(`${SMU_TALK_API_BASE}/integrations/link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.detail || "코드 확인에 실패했습니다.");
  }
  await chrome.storage.local.set({
    [STORAGE_KEYS.token]: body.token,
    [STORAGE_KEYS.user]: body.user,
  });
  return body.user;
}

async function handleSync() {
  const stored = await chrome.storage.local.get([STORAGE_KEYS.token]);
  const token = stored[STORAGE_KEYS.token];
  if (!token) {
    throw new Error("NOT_LINKED");
  }

  const tab = await getSmulTab();
  if (!tab) {
    throw new Error("OPEN_TAB_REQUIRED");
  }

  const gradesResponse = await chrome.tabs.sendMessage(tab.id, { type: "FETCH_GRADES" });
  if (!gradesResponse?.ok) {
    throw new Error(gradesResponse?.error || "학점 조회에 실패했습니다.");
  }

  const syncResponse = await fetch(`${SMU_TALK_API_BASE}/integrations/grades`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(gradesResponse.payload),
  });
  const syncBody = await syncResponse.json().catch(() => ({}));
  if (!syncResponse.ok) {
    throw new Error(syncBody.detail || "동기화에 실패했습니다.");
  }

  const syncedAt = new Date().toISOString();
  await chrome.storage.local.set({ [STORAGE_KEYS.lastSyncedAt]: syncedAt });
  return { ...syncBody, syncedAt };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "LINK") {
    handleLink(message.code)
      .then((user) => sendResponse({ ok: true, user }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === "SYNC") {
    handleSync()
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  return undefined;
});
