"use client";

import { Layout } from '../components/Layout';
import { ThemeProvider } from '../components/ThemeProvider';

export default function Home() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Layout />
    </ThemeProvider>
  );
}
