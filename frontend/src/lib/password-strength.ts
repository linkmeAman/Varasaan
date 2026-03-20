export type PasswordStrength = {
  score: number;
  label: 'Weak' | 'Fair' | 'Good' | 'Strong';
};

export function getPasswordStrength(password: string): PasswordStrength {
  let score = 0;

  if (password.length >= 12) {
    score += 1;
  }
  if (/[A-Z]/.test(password)) {
    score += 1;
  }
  if (/[a-z]/.test(password) && /\d/.test(password)) {
    score += 1;
  }
  if (/[^A-Za-z0-9]/.test(password)) {
    score += 1;
  }

  if (score >= 4) {
    return { score, label: 'Strong' };
  }
  if (score === 3) {
    return { score, label: 'Good' };
  }
  if (score === 2) {
    return { score, label: 'Fair' };
  }
  return { score, label: 'Weak' };
}

