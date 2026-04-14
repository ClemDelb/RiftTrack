import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@rifttrack/home_config';

export interface HomeConfig {
  showSoloQueue:  boolean;
  showFlexQueue:  boolean;
  showMasteries:  boolean;
  showRecentPerf: boolean;
}

const DEFAULT_CONFIG: HomeConfig = {
  showSoloQueue:  true,
  showFlexQueue:  true,
  showMasteries:  true,
  showRecentPerf: true,
};

interface HomeConfigContextType {
  homeConfig: HomeConfig;
  updateHomeConfig: (updates: Partial<HomeConfig>) => Promise<void>;
}

const HomeConfigContext = createContext<HomeConfigContextType | null>(null);

export function HomeConfigProvider({ children }: { children: React.ReactNode }) {
  const [homeConfig, setHomeConfig] = useState<HomeConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        if (raw) setHomeConfig({ ...DEFAULT_CONFIG, ...JSON.parse(raw) });
      })
      .catch(console.error);
  }, []);

  const updateHomeConfig = useCallback(async (updates: Partial<HomeConfig>) => {
    setHomeConfig(prev => {
      const next = { ...prev, ...updates };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(console.error);
      return next;
    });
  }, []);

  return (
    <HomeConfigContext.Provider value={{ homeConfig, updateHomeConfig }}>
      {children}
    </HomeConfigContext.Provider>
  );
}

export function useHomeConfig() {
  const ctx = useContext(HomeConfigContext);
  if (!ctx) throw new Error('useHomeConfig must be inside HomeConfigProvider');
  return ctx;
}
