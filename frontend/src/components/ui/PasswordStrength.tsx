'use client';

import { getPasswordStrength } from '../../lib/password-strength';

export function PasswordStrength({ password }: { password: string }) {
  if (!password) {
    return null;
  }

  const strength = getPasswordStrength(password);
  return (
    <div className="password-strength">
      <div className="password-strength-bars" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={`password-strength-bar ${index < strength.score ? `is-${strength.label.toLowerCase()}` : ''}`}
          />
        ))}
      </div>
      <p className="input-helper-msg">Password strength: {strength.label}</p>
    </div>
  );
}

