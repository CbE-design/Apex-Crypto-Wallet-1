
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const response = await fetch('https://api.frankfurter.app/latest?from=USD');
    if (!response.ok) {
      throw new Error(`Failed to fetch from frankfurter.app: ${response.statusText}`);
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    let message = 'Unknown Error'
    if (error instanceof Error) message = error.message
    console.error('Error fetching currency rates:', message);
    return NextResponse.json({ error: 'Failed to fetch currency rates' }, { status: 500 });
  }
}
