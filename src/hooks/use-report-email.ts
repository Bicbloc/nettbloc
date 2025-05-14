
import { useState } from 'react';

export function useReportEmail() {
  const [email, setEmail] = useState<string>('');
  const [isValid, setIsValid] = useState<boolean>(false);

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
