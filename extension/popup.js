// 팝업은 UI만 담당합니다. SMU-Talk API 호출과 토큰 저장은 전부 background.js가 처리하고,
// 여기서는 메시지만 주고받습니다.

const els = {
  linkView: document.getElementById("linkView"),
  syncView: document.getElementById("syncView"),
  codeInput: document.getElementById("codeInput"),
  linkButton: document.getElementById("linkButton"),
  syncButton: document.getElementById("syncButton"),
  unlinkButton: document.getElementById("unlinkButton"),
  userLabel: document.getElementById("userLabel"),
  lastSynced: document.getElementById("lastSynced"),
  status: document.getElementById("status"),
  studentNoInput: document.getElementById("studentNoInput"),
  studentNameInput: document.getElementById("studentNameInput"),
  saveIdentityButton: document.getElementById("saveIdentityButton"),
  identityStatus: document.getElementById("identityStatus"),
};

function setStatus(text, kind) {
  els.status.textContent = text || "";
  els.status.className = kind || "";
}

async function refreshView() {
  const stored = await chrome.storage.local.get(["smuTalkToken", "smuTalkUser", "smuTalkLastSyncedAt"]);
  if (stored.smuTalkToken) {
    els.linkView.style.display = "none";
    els.syncView.style.display = "block";
    els.userLabel.textContent = stored.smuTalkUser ? `${stored.smuTalkUser.nickname} 님 연동됨` : "연동됨";
    els.lastSynced.textContent = stored.smuTalkLastSyncedAt
      ? `마지막 동기화: ${new Date(stored.smuTalkLastSyncedAt).toLocaleString("ko-KR")}`
      : "아직 동기화한 적이 없습니다.";
  } else {
    els.linkView.style.display = "block";
    els.syncView.style.display = "none";
  }
}

els.linkButton.addEventListener("click", async () => {
  const code = els.codeInput.value.trim().toUpperCase();
  if (code.length !== 8) {
    setStatus("8자리 코드를 입력하세요.", "error");
    return;
  }
  setStatus("확인 중...");
  const response = await chrome.runtime.sendMessage({ type: "LINK", code });
  if (response?.ok) {
    setStatus("연동되었습니다.", "ok");
    await refreshView();
  } else {
    setStatus(response?.error || "연동에 실패했습니다.", "error");
  }
});

els.syncButton.addEventListener("click", async () => {
  setStatus("smul.smu.ac.kr에서 학점을 가져오는 중...");
  const response = await chrome.runtime.sendMessage({ type: "SYNC" });
  if (response?.ok) {
    setStatus("동기화 완료.", "ok");
    await refreshView();
  } else if (response?.error === "OPEN_TAB_REQUIRED") {
    setStatus("smul.smu.ac.kr 탭을 새로 엽니다. 로그인 후 다시 시도해주세요.", "error");
    chrome.tabs.create({ url: "https://smul.smu.ac.kr/" });
  } else {
    setStatus(response?.error || "동기화에 실패했습니다.", "error");
  }
});

els.unlinkButton.addEventListener("click", async () => {
  await chrome.storage.local.remove(["smuTalkToken", "smuTalkUser", "smuTalkLastSyncedAt"]);
  setStatus("연동이 해제되었습니다.", "ok");
  await refreshView();
});

async function loadIdentity() {
  const stored = await chrome.storage.local.get(["smulStudentNo", "smulStudentName"]);
  els.studentNoInput.value = stored.smulStudentNo || "";
  els.studentNameInput.value = stored.smulStudentName || "";
}

els.saveIdentityButton.addEventListener("click", async () => {
  const smulStudentNo = els.studentNoInput.value.trim();
  const smulStudentName = els.studentNameInput.value.trim();
  if (!smulStudentNo || !smulStudentName) {
    els.identityStatus.textContent = "학번과 이름을 모두 입력하세요.";
    els.identityStatus.className = "error";
    return;
  }
  await chrome.storage.local.set({ smulStudentNo, smulStudentName });
  els.identityStatus.textContent = "저장되었습니다.";
  els.identityStatus.className = "ok";
});

refreshView();
loadIdentity();
