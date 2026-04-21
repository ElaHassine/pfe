import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, patientApi, setAuthToken } from '../services/api';

const AuthContext = createContext(null);
const TOKEN_KEY = 'lesio.auth.token';
const USER_KEY = 'lesio.auth.user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const hydrateSession = async () => {
      try {
        const [storedToken, storedUser] = await AsyncStorage.multiGet([TOKEN_KEY, USER_KEY]);
        const tokenVal = storedToken?.[1] || null;
        const userVal = storedUser?.[1] || null;

        if (!tokenVal || !userVal) {
          if (mounted) setIsLoading(false);
          return;
        }

        const parsedUser = JSON.parse(userVal);
        if (mounted) {
          setToken(tokenVal);
          setUser(parsedUser);
        }
        setAuthToken(tokenVal);

        try {
          const fresh = await authApi.me();
          if (mounted && fresh?.patient) {
            setUser(fresh.patient);
          }
          await AsyncStorage.setItem(USER_KEY, JSON.stringify(fresh?.patient || parsedUser));
        } catch (error) {
          if (error?.status === 401) {
            setAuthToken(null);
            if (mounted) {
              setToken(null);
              setUser(null);
            }
            await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
          }
        }
      } catch (_error) {
        // Keep app usable even if storage is temporarily unavailable.
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    hydrateSession();
    return () => { mounted = false; };
  }, []);

  const login = async (email, password) => {
    setIsLoading(true);

    try {
      const result = await authApi.login({ email, password });
      setToken(result.token);
      setAuthToken(result.token);
      setUser(result.patient);
      await AsyncStorage.multiSet([
        [TOKEN_KEY, result.token],
        [USER_KEY, JSON.stringify(result.patient)],
      ]);
      return result.patient;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data) => {
    setIsLoading(true);

    try {
      const profile = {
        firstName: data.name?.trim().split(' ')[0] || '',
        lastName: data.name?.trim().split(' ').slice(1).join(' '),
        fullName: data.name?.trim(),
      };

      const result = await authApi.register({
        email: data.email,
        password: data.password,
        profile,
      });

      setToken(result.token);
      setAuthToken(result.token);
      setUser(result.patient);
      await AsyncStorage.multiSet([
        [TOKEN_KEY, result.token],
        [USER_KEY, JSON.stringify(result.patient)],
      ]);
      return result.patient;
    } finally {
      setIsLoading(false);
    }
  };

  const googleSignIn = async ({ email, fullName, avatarUrl }) => {
    setIsLoading(true);

    try {
      const result = await authApi.google({ email, fullName, avatarUrl });
      setToken(result.token);
      setAuthToken(result.token);
      setUser(result.patient);
      await AsyncStorage.multiSet([
        [TOKEN_KEY, result.token],
        [USER_KEY, JSON.stringify(result.patient)],
      ]);
      return result.patient;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshMe = async () => {
    const result = await authApi.me();
    setUser(result.patient);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(result.patient));
    return result.patient;
  };

  const updateProfile = async (payload) => {
    const result = await authApi.updateMe(payload);
    setUser(result.patient);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(result.patient));
    return result.patient;
  };

  const getMyActivity = async () => {
    const result = await patientApi.getActivity();
    return result.events || [];
  };

  const getMySummary = async () => {
    const result = await patientApi.getSummary();
    return result.stats || {};
  };

  const getMyLikedPosts = async () => {
    const patientId = user?._id;
    if (!patientId) return [];
    const result = await patientApi.getLikedPosts(patientId);
    return result.posts || [];
  };

  const logout = async () => {
    setUser(null);
    setToken(null);
    setAuthToken(null);
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isLoading,
      login,
      register,
      googleSignIn,
      refreshMe,
      updateProfile,
      getMyActivity,
      getMySummary,
      getMyLikedPosts,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
