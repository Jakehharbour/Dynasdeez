'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ThemeProviderProps } from 'next-themes';

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      scriptProps={{
        type: 'application/json', // Prevents React 19 script execution warning
      }}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}