import { useState, useEffect } from 'react';

type AuthUser = { email?: string; sub?: string } | null;

export default function useAuth() {
  const [user, setUser] = useState<AuthUser>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const who = await fetch(`${import.meta.env.VITE_API_URL}/protected`, {
          method: 'GET',
          credentials: 'include',
        });
        if (!mounted) return;
        if (who.ok) {
          const wj = await who.json();
          if (wj && wj.sub) setUser({ email: wj.sub });
        }
      } catch (e) {
        console.error('useEffect fetch protected error', e);
      }
      if (mounted) setInitializing(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const requestOtp = async (body: { phone?: string; email?: string }) => {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/auth/request-otp`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    return res;
  };

  const verifyOtp = async (body: {
    phone?: string;
    email?: string;
    code: string;
  }) => {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/verify-otp`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      setUser(null);
      return { ok: false, res } as const;
    }

    try {
      const who = await fetch(`${import.meta.env.VITE_API_URL}/protected`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!who.ok) {
        setUser(null);
        return { ok: false, res } as const;
      }

      const wj = await who.json();
      if (wj && wj.sub) {
        setUser({ email: wj.sub });
        return { ok: true, subject: wj.sub, res } as const;
      }
    } catch (ee) {
      console.error('verifyOtp fetch protected error', ee);
      return { ok: false, res } as const;
    }

    return { ok: false, res } as const;
  };

  const subject = user ? user.email || user.sub || null : null;

  const signOut = async () => {
    setUser(null);
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (e) {
      console.error('signOut error', e);
    }
  };

  return {
    user,
    setUser,
    initializing,
    requestOtp,
    verifyOtp,
    subject,
    signOut,
  } as const;
}
