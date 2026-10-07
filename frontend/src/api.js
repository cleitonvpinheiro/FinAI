import { fetch as expoFetch } from "expo/fetch";

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

let token = null;
let onUnauthorized = null;

export const setApiToken = (t) => {
  token = t;
};
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

function headers() {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function errorMessage(data) {
  if (!data?.detail) return "Erro de conexão. Tente novamente.";
  if (typeof data.detail === "string") return data.detail;
  return "Verifique os dados informados.";
}

export async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (res.status === 401 && token && onUnauthorized) onUnauthorized();
  if (!res.ok) throw new Error(errorMessage(data));
  return data;
}

// Streams an AI insight over SSE. Calls onDelta for each text chunk and
// resolves with the saved insight.
export async function streamInsight(body, onDelta) {
  const res = await expoFetch(BASE + "/insights/stream", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(errorMessage(data));
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let final = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 2);
      if (!line.startsWith("data:")) continue;
      const ev = JSON.parse(line.slice(5));
      if (ev.error) throw new Error("A IA não respondeu. Tente novamente.");
      if (ev.delta) onDelta(ev.delta);
      if (ev.done) final = ev.insight;
    }
  }
  return final;
}
