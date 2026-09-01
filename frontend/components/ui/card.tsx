import * as React from 'react';
import { cn } from '@/lib/utils';

const make = (tag: 'div' | 'h3' | 'p', base: string, name: string) => {
  const Comp = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
    ({ className, ...props }, ref) =>
      React.createElement(tag, { ref, className: cn(base, className), ...props }),
  );
  Comp.displayName = name;
  return Comp as React.ForwardRefExoticComponent<
    React.HTMLAttributes<HTMLElement> & React.RefAttributes<HTMLElement>
  >;
};

export const Card = make('div', 'rounded-xl border bg-card text-card-foreground shadow-sm', 'Card');
export const CardHeader = make('div', 'flex flex-col space-y-1.5 p-6', 'CardHeader');
export const CardTitle = make('h3', 'font-semibold leading-none tracking-tight', 'CardTitle');
export const CardDescription = make('p', 'text-sm text-muted-foreground', 'CardDescription');
export const CardContent = make('div', 'p-6 pt-0', 'CardContent');
export const CardFooter = make('div', 'flex items-center p-6 pt-0', 'CardFooter');
