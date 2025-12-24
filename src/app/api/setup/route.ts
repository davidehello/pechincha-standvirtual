import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function POST() {
  try {
    const supabase = getSupabase();

    // Test the connection by doing a simple query
    const { error } = await supabase
      .from('listings')
      .select('id')
      .limit(1);

    if (error) {
      // If the table doesn't exist, the error message will indicate that
      if (error.message.includes('does not exist')) {
        return NextResponse.json({
          success: false,
          message: 'Tables do not exist. Please create them in the Supabase dashboard.',
          error: error.message
        }, { status: 400 });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Database connection verified. Tables exist.'
    });
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json(
      { error: 'Failed to verify database', details: String(error) },
      { status: 500 }
    );
  }
}
