import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 현재 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 인증 상태 변경 구독
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Magic Link (이메일 로그인 링크 전송)
  const signInWithMagicLink = useCallback(async (email) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    return { error };
  }, []);

  // 이메일 + 비밀번호 회원가입
  const signUp = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    return { error };
  }, []);

  // 이메일 + 비밀번호 로그인
  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  // 로그아웃
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return { user, loading, signInWithMagicLink, signUp, signIn, signOut };
}
