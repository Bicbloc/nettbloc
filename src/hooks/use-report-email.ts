
import { useState, useEffect } from 'react';
import { getReportEmail, saveReportEmail } from '@/lib/utils';

export function useReportEmail() {
  const [email, setEmail] = useState<string>('');
  const [isValid, setIsValid] = useState<boolean>(false);

  // Load saved email on first render
  useEffect(() => {
    const savedEmail = getReportEmail();
    if (savedEmail) {
      setEmail(savedEmail);
      validateEmail(savedEmail);
    }
  }, []);

  // Validate email format
  const validateEmail = (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const valid = emailRegex.test(value);
    setIsValid(valid);
    return valid;
  };

  const updateEmail = (value: string) => {
    setEmail(value);
    if (validateEmail(value)) {
      saveReportEmail(value); // Save valid email
    }
  };

  return {
    email,
    setEmail: updateEmail,
    isValid,
  };
}
