async function testSave() {
  const payload = {
    subject_id: 1,
    local_uri: 'file:///test_from_script.jpg'
  };
  
  try {
    const response = await fetch('http://localhost:3000/api/photos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: This might fail if authenticateToken is active and strict
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', data);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testSave();
