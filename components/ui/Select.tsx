import {SelectHTMLAttributes, forwardRef} from 'react';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({className = '', children, ...props}, ref) => (
    <select
      ref={ref}
      className={`block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 ${className}`}
      {...props}
    >
      {children}
    </select>
  ),
);

Select.displayName = 'Select';

export default Select;
