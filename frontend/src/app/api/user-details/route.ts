import { NextRequest, NextResponse } from 'next/server';

const userProblemsSolvedQuery = (username: string) => `
{
  matchedUser(username: "${username}") {
    submitStats {
      acSubmissionNum {
        difficulty
        count
      }
    }
  }
}
`;

export async function POST(req: NextRequest) {
  try {
    const { username } = await req.json();

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    // Fetching data using the problems solved query
    const problemsResponse = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: userProblemsSolvedQuery(username) }),
    });

    // Parsing the responses
    const problemsData = await problemsResponse.json();

    if (!problemsResponse.ok || problemsData.errors) {
      return NextResponse.json({ error: 'Failed to fetch problems data', details: problemsData.errors }, { status: problemsResponse.status });
    }

    return NextResponse.json({
      problemsSolved: problemsData.data.matchedUser.submitStats.acSubmissionNum,
    });
  } catch (error: any) {
    console.error('Error fetching data:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method GET Not Allowed' }, { status: 405 });
}
