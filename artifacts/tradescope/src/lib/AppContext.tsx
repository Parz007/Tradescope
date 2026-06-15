import React, { createContext, useContext, useEffect, useState } from "react";
import { User } from "@workspace/api-client-react";
import { useUpsertUser } from "@workspace/api-client-react";

interface AppContextType {
  user: User | null;
  telegramUser: any;
  isLoading: boolean;
}

const AppContext = createContext<AppContextType>({
  user: null,
  telegramUser: null,
  isLoading: true,
});

export const useAppContext = () => useContext(AppContext);

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [telegramUser, setTelegramUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const upsertUser = useUpsertUser();

  useEffect(() => {
    const initApp = async () => {
      let tUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
      
      if (!tUser) {
        // demo data
        tUser = {
          id: "123456789",
          first_name: "Trader",
          last_name: "",
          username: "trader",
        };
      }
      
      setTelegramUser(tUser);
      
      try {
        const result = await upsertUser.mutateAsync({
          data: {
            telegramId: String(tUser.id),
            firstName: tUser.first_name,
            lastName: tUser.last_name,
            username: tUser.username,
          }
        });
        setUser(result);
      } catch {
        // non-fatal: app works in demo mode without a persisted user
      } finally {
        setIsLoading(false);
      }
    };
    
    initApp();
  }, []);

  return (
    <AppContext.Provider value={{ user, telegramUser, isLoading }}>
      {children}
    </AppContext.Provider>
  );
};
