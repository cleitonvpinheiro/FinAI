import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { api, setApiToken, setUnauthorizedHandler } from "@/src/api";
import { queryClient } from "@/src/query-client";
import { storage } from "@/src/utils/storage";

WebBrowser.maybeCompleteAuthSession();

const TOKEN_KEY = "finai_token";
const AuthContext = createContext(null);

const extractSessionId = (url) => {
  if (!url) return null;
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
};

export function AuthProvider({ children }) {
  // undefined = loading, null = signed out, object = signed in
  const [user, setUser] = useState(undefined);
  const usedSessionIds = useRef(new Set());

  const saveSession = useCallback(async (token, u) => {
    setApiToken(token);
    await storage.secureSet(TOKEN_KEY, token);
    setUser(u);
  }, []);

  const signOutLocal = useCallback(async () => {
    setApiToken(null);
    await storage.secureRemove(TOKEN_KEY);
    queryClient.clear();
    setUser(null);
  }, []);

  const exchangeSession = useCallback(
    async (sessionId) => {
      if (!sessionId || usedSessionIds.current.has(sessionId)) return false;
      usedSessionIds.current.add(sessionId);
      const data = await api("/auth/session", { method: "POST", body: { session_id: sessionId } });
      await saveSession(data.token, data.user);
      return true;
    },
    [saveSession],
  );

  useEffect(() => {
    setUnauthorizedHandler(signOutLocal);
    let sub;
    (async () => {
      try {
        if (Platform.OS === "web") {
          const sid = extractSessionId(window.location.href);
          if (sid) {
            await exchangeSession(sid);
            const url = new URL(window.location.href);
            url.searchParams.delete("session_id");
            url.hash = url.hash.replace(/[#&]?session_id=[^&#]+/, "");
            window.history.replaceState(window.history.state, "", url.toString());
            return;
          }
        } else {
          const initial = await Linking.getInitialURL();
          if (await exchangeSession(extractSessionId(initial)).catch(() => false)) return;
        }
        const token = await storage.secureGet(TOKEN_KEY, null);
        if (!token) return setUser(null);
        setApiToken(token);
        const me = await api("/auth/me");
        setUser(me);
      } catch {
        await signOutLocal();
      }
    })();
    if (Platform.OS !== "web") {
      sub = Linking.addEventListener("url", ({ url }) => {
        exchangeSession(extractSessionId(url)).catch(() => {});
      });
    }
    return () => sub?.remove();
  }, [exchangeSession, signOutLocal]);

  const login = async (email, password) => {
    const data = await api("/auth/login", { method: "POST", body: { email, password } });
    await saveSession(data.token, data.user);
  };

  const register = async (name, email, password) => {
    const data = await api("/auth/register", { method: "POST", body: { name, email, password } });
    await saveSession(data.token, data.user);
  };

  const loginWithGoogle = async () => {
    const redirectUrl = Platform.OS === "web" ? window.location.origin + "/" : Linking.createURL("");
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    if (Platform.OS === "web") {
      window.location.href = authUrl;
      return;
    }
    let captured = null;
    const listener = Linking.addEventListener("url", ({ url }) => {
      captured = url;
    });
    try {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      const url = (result.type === "success" && result.url) || captured || (await Linking.getInitialURL());
      const sid = extractSessionId(url);
      if (sid) await exchangeSession(sid);
    } finally {
      listener.remove();
    }
  };

  const logout = async () => {
    api("/auth/logout", { method: "POST" }).catch(() => {});
    await signOutLocal();
  };

  return (
    <AuthContext.Provider value={{ user, login, register, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
