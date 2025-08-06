// NextAuth API route placeholder
// This will be implemented when full authentication is set up

import { NextRequest } from 'next/server'

export async function GET(_request: NextRequest) {
  return new Response(JSON.stringify({ message: 'Auth not yet configured' }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })
}

export async function POST(_request: NextRequest) {
  return new Response(JSON.stringify({ message: 'Auth not yet configured' }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })
}