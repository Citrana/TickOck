import {InputHTMLAttributes, forwardRef} from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({className = '', ...props}, ref) => (
    <input
      ref={ref}
      className={`block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 ${className}`}
      {...props}
    />
  ),
);

Input.displayName = 'Input';

export default Input;
