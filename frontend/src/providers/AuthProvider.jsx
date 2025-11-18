import React, { createContext, useState, useEffect } from "react";
import * as api from "../utils/api";

export const AuthContext = createContext();

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("token") || null);
  const [loading, setLoading] = useState(true);

  // เช็ค token และ session ทุกครั้งที่ mount หรือ token เปลี่ยน
  useEffect(() => {
    let ignore = false;
    async function checkSession() {
      if (token) {
        try {
          const res = await api.getMe(token);
          if (!ignore) {
            setUser(res.data); // set user object
          }
        } catch (err) {
          // Token/Session invalid หรือหมดอายุ ให้ลบออก
          setUser(null);
          setToken(null);
          localStorage.removeItem("token");
        } finally {
          setLoading(false);
        }
      } else {
        setUser(null);
        setLoading(false);
      }
    }
    checkSession();
    return () => { ignore = true; };
  }, [token]);

  // Intercept ทุก request ถ้าเจอ 401 (token/Session invalid) ให้ logout อัตโนมัติ
  useEffect(() => {
    const interceptor = api.default.interceptors.response.use(
      res => res,
      err => {
        if (err.response?.status === 401) {
          setUser(null);
          setToken(null);
          localStorage.removeItem("token");
        }
        return Promise.reject(err);
      }
    );
    return () => api.default.interceptors.response.eject(interceptor);
  }, []);

  // login/logout ฟังก์ชัน
  const login = async (username, password) => {
  setLoading(true);
  try {
    const res = await api.login({ username, password });
    setToken(res.data.token);
    localStorage.setItem("token", res.data.token);
    setUser(res.data.admin); // แล้วแต่ backend
    return res.data.admin;
  } catch (err) {
    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
    throw err; // ให้ caller handle error ได้
  } finally {
    setLoading(false);
  }
};
const logout = async () => {
  if (token) {
    try { await api.logout(token); } catch {}
  }
  setUser(null);
  setToken(null);
  localStorage.removeItem("token");
  setLoading(false);
};

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
