import { useEffect } from "react";

export function useTelegramBackButton(onBack: () => void) {
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg?.BackButton) return;

    tg.BackButton.show();
    tg.BackButton.onClick(onBack);

    return () => {
      tg.BackButton.hide();
      tg.BackButton.offClick(onBack);
    };
  }, [onBack]);
}
