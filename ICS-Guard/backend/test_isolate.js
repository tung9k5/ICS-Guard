import axios from 'axios';

async function run() {
  const baseURL = 'http://localhost:8000/api';
  console.log('Logging in...');
  try {
    const loginRes = await axios.post(`${baseURL}/auth/login`, {
      username_or_email: 'admin_soc',
      password: 'Admin@123'
    });

    const token = loginRes.data.accessToken;
    console.log('Login successful. Token:', token.substring(0, 20) + '...');

    const headers = { Authorization: `Bearer ${token}` };
    console.log('Attempting to isolate device: actuator-siren-01');

    const isolateRes = await axios.post(
      `${baseURL}/devices/actuator-siren-01/isolate`,
      {},
      { headers }
    );
    console.log('Response status:', isolateRes.status);
    console.log('Response body:', JSON.stringify(isolateRes.data));

    // Unisolate immediately
    console.log('Attempting to unisolate device: actuator-siren-01');
    const unisolateRes = await axios.post(
      `${baseURL}/devices/actuator-siren-01/unisolate`,
      {},
      { headers }
    );
    console.log('Unisolate Response status:', unisolateRes.status);

  } catch (error) {
    if (error.response) {
      console.log('Request failed with status:', error.response.status);
      console.log('Request failed with body:', JSON.stringify(error.response.data));
    } else {
      console.error('Error without response:', error.message);
    }
  }
}
run();
