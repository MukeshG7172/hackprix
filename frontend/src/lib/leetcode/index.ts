const getLeetCodeUserDetails = async (username: string) => {  
  try {
    const response = await fetch('/api/user-details/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch data');
    }

    const userDetails = await response.json();
    console.log('User Details:', userDetails);

    return {
      username: username || 'N/A',
      contestRanking: userDetails.contestRanking || [],
      problemsSolved: userDetails.problemsSolved || [],
    };
  } catch (err) {
    console.error(err);
    return null;
  }
};

export default getLeetCodeUserDetails;
