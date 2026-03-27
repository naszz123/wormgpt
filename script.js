(function() {
    const isTelegram = navigator.userAgent.includes('Telegram') || 
                       window.location.href.includes('tgWebApp') ||
                       (window.Telegram && Telegram.WebApp);
    
    if (isTelegram) {
        try {
            if (window.Telegram && Telegram.WebApp) {
                Telegram.WebApp.ready();
                Telegram.WebApp.expand();
            }
        } catch (e) {
            console.log('Telegram WebApp tidak tersedia');
        }
    }
})();

const $ = (id) => document.getElementById(id);

const chatInput = $("chatInput");
const actionBtn = $("actionBtn");
const hero = $("hero");
const chatArea = $("chatArea");
const chatWrap = $("chatWrap");

const sidebar = $("sidebar");
const sidebarBackdrop = $("sidebarBackdrop");

function nowLabel(ts) {
  const d = new Date(ts || Date.now());
  const hh = String(d.getHours()).padStart(2,"0");
  const mm = String(d.getMinutes()).padStart(2,"0");
  return hh + ":" + mm;
}

function scrollToBottom() {
  chatArea.scrollTop = chatArea.scrollHeight;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function parseMarkdown(text) {
  const safe = escapeHtml(text);
  
  const withFormatting = safe
    .replace(/```([\s\S]*?)```/g, (m, code) => {
      return "<pre><code>" + code + "</code></pre>";
    })
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/_([^_]+)_/g, "<em>$1</em>");
  
  return withFormatting;
}

function addDownloadButtonsToCodeBlocks() {
  setTimeout(() => {
    const preElements = document.querySelectorAll('.msg pre');

    preElements.forEach((pre) => {
      if (pre.querySelector('.code-copy-btn')) return;

      const code = pre.querySelector('code');
      if (!code) return;

      const codeText = code.textContent || code.innerText;

      const btn = document.createElement('button');
      btn.className = 'code-copy-btn';
      btn.textContent = 'Salin';
      btn.title = 'Salin kode';

      btn.addEventListener('click', async (e) => {
        e.stopPropagation();

        try {
          await navigator.clipboard.writeText(codeText);

          btn.classList.add('copied');
          btn.textContent = 'Tersalin';

          setTimeout(() => {
            btn.classList.remove('copied');
            btn.textContent = 'Salin';
          }, 1200);

        } catch (err) {
          toastShow("Gagal menyalin");
        }
      });

      pre.style.position = 'relative';
      pre.appendChild(btn);
    });
  }, 100);
}

function setHeroVisibility() {
  const anyMsg = chatWrap.querySelector(".msg-row");
  hero.classList.toggle("hide", Boolean(anyMsg));
}

function renderMessage(role, text, ts) {
  const row = document.createElement("div");
  row.className = "msg-row " + (role === "user" ? "user" : "assistant");

  const wrap = document.createElement("div");
  wrap.className = "msg-wrap";

  const bubble = document.createElement("div");
  bubble.className = "msg " + (role === "user" ? "user" : "assistant");
  bubble.innerHTML = parseMarkdown(text);

  const meta = document.createElement("div");
  meta.className = "msg-meta";
  meta.textContent = nowLabel(ts);

  wrap.appendChild(bubble);
  wrap.appendChild(meta);
  row.appendChild(wrap);
  chatWrap.appendChild(row);

  setHeroVisibility();
  addDownloadButtonsToCodeBlocks();
  setTimeout(scrollToBottom, 0);
}

function clearMessages() {
  const nodes = Array.from(chatWrap.querySelectorAll(".msg-row"));
  for (const n of nodes) n.remove();
  setHeroVisibility();
  setTimeout(scrollToBottom, 0);
}

function toastShow(text) {
  const toast = $("toast");
  $("toastText").textContent = text;
  toast.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove("show"), 2600);
}

function toggleSidebar(force) {
  const next = typeof force === "boolean" ? force : !sidebar.classList.contains("show");
  sidebar.classList.toggle("show", next);
  sidebarBackdrop.classList.toggle("show", next);
}

function closeSidebar() {
  toggleSidebar(false);
}

function autoResize() {
  chatInput.style.height = "0px";
  const newHeight = Math.min(chatInput.scrollHeight, 120);
  chatInput.style.height = newHeight + "px";
}

function updateSendButton() {
  const hasText = chatInput.value.trim().length > 0;
  actionBtn.classList.toggle("disabled", !hasText);
  actionBtn.classList.toggle("ready", hasText);
  actionBtn.disabled = !hasText;
}

function startNewChat() {
  clearMessages();
  toastShow("Chat baru dibuat");
  closeSidebar();
  chatInput.focus();
}

function addTyping() {
  const row = document.createElement("div");
  row.className = "msg-row assistant";
  const wrap = document.createElement("div");
  wrap.className = "msg-wrap";
  const bubble = document.createElement("div");
  bubble.className = "msg assistant";
  bubble.innerHTML = '<span class="typing"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>';
  wrap.appendChild(bubble);
  row.appendChild(wrap);
  chatWrap.appendChild(row);
  setHeroVisibility();
  setTimeout(scrollToBottom, 0);
  return row;
}

async function askAI(askText) {
  const maxRetries = 2;
  let lastError = null;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      
      const headers = {
        "Content-Type": "application/json"
      };
      
      if (navigator.userAgent.includes('Telegram')) {
        headers['X-Telegram-WebApp'] = 'true';
      }
      
      const res = await fetch("/api/wormgpt", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ text: askText }),
        signal: controller.signal,
        credentials: 'include'
      });
      
      clearTimeout(timeout);
      
      if (!res.ok) {
        throw new Error("HTTP " + res.status);
      }
      
      const text = await res.text();
      
      try {
        const json = JSON.parse(text);
        if (json.error) {
          throw new Error(json.error);
        }
        return json.result || json.response || json.text || json.message || JSON.stringify(json, null, 2);
      } catch (e) {
        return text;
      }
      
    } catch (e) {
      lastError = e;
      console.log(`Percobaan ${i + 1} gagal:`, e);
      
      if (i < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }
    }
  }
  
  throw lastError || new Error("Gagal setelah beberapa percobaan");
}

async function sendCurrentText() {
  const text = chatInput.value.trim();
  if (!text) return;

  renderMessage("user", text, Date.now());
  chatInput.value = "";
  autoResize();
  updateSendButton();

  const typingRow = addTyping();
  
  try {
    const answer = await askAI(text);
    typingRow.remove();
    renderMessage("assistant", answer || "(Kosong)", Date.now());
  } catch (e) {
    typingRow.remove();
    
    let errorMsg = "Gagal mendapatkan jawaban dari WormGPT karena masalah database. Silahkan hubungi developer. ";
    
    if (navigator.userAgent.includes('Telegram')) {
      errorMsg += "Gagal mendapatkan jawaban dari WormGPT karena koneksi anda terputus. Silahkan berikan perintah ulang. ";
    } else {
      errorMsg += "Gagal mendapatkan jawaban dari WormGPT karena masalah endpoint api. Silahkan hubungi developer. ";
    }
    
    errorMsg += "Error: " + (e.message || "Unknown error");
    
    renderMessage("assistant", errorMsg, Date.now());
    
    if (window.Telegram && Telegram.WebApp) {
      Telegram.WebApp.HapticFeedback.notificationOccurred('error');
    }
  }
}

$("menuBtn").addEventListener("click", () => toggleSidebar());
$("sideClose").addEventListener("click", closeSidebar);
sidebarBackdrop.addEventListener("click", closeSidebar);

$("telegramBtn").addEventListener("click", () => window.open("https://t.me/pherine", "_blank", "noopener,noreferrer"));
$("newChatTopBtn").addEventListener("click", startNewChat);

$("plusBtn").addEventListener("click", () => toastShow("Fiture ini masih dalam pemeliharaan"));
$("toastClose").addEventListener("click", () => $("toast").classList.remove("show"));

$("newChatBtn").addEventListener("click", startNewChat);

chatInput.addEventListener("input", () => {
  autoResize();
  updateSendButton();
});

chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    sendCurrentText();
  }
});

actionBtn.addEventListener("click", () => {
  if (actionBtn.disabled) return;
  sendCurrentText();
});

window.addEventListener("load", () => {
  const intro = $("introOverlay");
  if (intro) {
    setTimeout(() => {
      intro.classList.add("hide");
      setTimeout(() => { try { intro.remove(); } catch (e) {} }, 620);
    }, 3000);
  }
  clearMessages();
  autoResize();
  updateSendButton();
  chatInput.focus();
});

let lastTouchEnd = 0;
document.addEventListener("touchend", (event) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) event.preventDefault();
  lastTouchEnd = now;
}, { passive: false });
