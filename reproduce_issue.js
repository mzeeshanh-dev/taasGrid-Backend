// import fetch from 'node-fetch'; // Native fetch is available in Node 18+

const BASE_URL = 'http://localhost:3001/api';

async function run() {
  // 1. Register a new company
  const email = `testcompany_${Date.now()}@example.com`;
  const password = 'password123';
  
  console.log(`Registering company: ${email}`);
  const registerRes = await fetch(`${BASE_URL}/auth/register/company`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      companyName: 'Test Company',
      email,
      password,
      plan: 'basic'
    })
  });

  const registerData = await registerRes.json();
  if (!registerRes.ok) {
    console.error('Registration failed:', registerData);
    return;
  }
  console.log('Registration successful:', registerData);

  // Extract cookies from registration response
  // Native fetch in Node 22 supports getSetCookie()
  const cookiesArray = registerRes.headers.getSetCookie();
  const cookies = cookiesArray.join('; ');
  console.log('Cookies received:', cookies);

  const companyId = registerData.company._id;

  // 2. Try to update the company using the cookies
  console.log(`Updating company: ${companyId}`);
  const updateRes = await fetch(`${BASE_URL}/company/${companyId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies
    },
    body: JSON.stringify({
      companyName: 'Updated Company Name'
    })
  });

  const updateData = await updateRes.json();
  
  if (updateRes.ok) {
    console.log('TEST PASSED');
  } else {
    console.log('TEST FAILED');
    console.log('Status:', updateRes.status);
    console.log('Response:', JSON.stringify(updateData));
  }
}

run().catch(err => {
  console.log('TEST CRASHED');
  console.error(err);
});
