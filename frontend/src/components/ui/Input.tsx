import React from 'react';
import { cn } from '../../lib/utils';
import './Input.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    return (
      <div className="input-wrapper">
        {label && (
          <label htmlFor={inputId} className="input-label">
            {label} {props.required && <span className="input-required">*</span>}
          </label>
        )}

        <input
          id={inputId}
          ref={ref}
          className={cn('input-field', error && 'input-error', className)}
          {...props}
        />

        {error && <p className="input-error-msg">{error}</p>}
        {helperText && !error && <p className="input-helper-msg">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
