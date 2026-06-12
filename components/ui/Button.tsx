import {ButtonHTMLAttributes} from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
};

export default function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonProps) {
  const base =
    'px-4 py-2 rounded-md font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants: Record<string, string> = {
    primary:
      'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary:
      'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-400',
    ghost:
      'text-gray-600 hover:bg-gray-100 focus:ring-gray-300',
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props} />
  );
}
