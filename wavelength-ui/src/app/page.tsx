"use client";

import { Layout } from '../components/Layout';
import { AuthInitializer } from '../components/auth/AuthInitializer';

export default function Home() {
  return (
    <>
      <AuthInitializer />
      <Layout />
    </>
  );
}
