
import { useState, useEffect } from 'react';

export function useReportEmail() {
  const [email, setEmail] = useState<string>('');
  const [isValid, setIsValid] = useState<boolean>(false);

  // Get email from localStorage on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('reportEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      validateEmail(savedEmail);
    }
  }, []);

  // Update localStorage when email changes
  useEffect(() => {
    if (isValid) {
      localStorage.setItem('reportEmail', email);
    }
  }, [email, isValid]);

  // Validate email format
  const validateEmail = (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const valid = emailRegex.test(value);
    setIsValid(valid);
    return valid;
  };

  const updateEmail = (value: string) => {
    setEmail(value);
    validateEmail(value);
  };

  return {
    email,
    setEmail: updateEmail,
    isValid,
  };
}
