
import { useState, useEffect } from "react";

export function useApiKey(keyName: string, defaultValue: string = "") {
  // Load value from localStorage on initial render
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(keyName);
      return saved !== null ? saved : defaultValue;
    } catch (error) {
      console.error("Error reading from localStorage:", error);
      return defaultValue;
    }
  });

  // Update localStorage when value changes
  useEffect(() => {
    try {
      if (value) {
        localStorage.setItem(keyName, value);
      }
    } catch (error) {
      console.error("Error saving to localStorage:", error);
    }
  }, [keyName, value]);

  return [value, setValue] as const;
}
