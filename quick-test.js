#!/usr/bin/env node

import axios from 'axios';

async function quickTest() {
  console.log('🚀 Quick Advanced Test Starting...');
  
  try {
    const response = await axios.post('http://localhost:8005/api/chat', {
      message: 'Create a new realm named "test-realm-123" with display name "Test Realm", enabled true, and registration allowed true',
      sessionId: 'test-session'
    }, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Test successful!');
    console.log('Response:', response.data.response?.substring(0, 200) + '...');
    console.log('Tools called:', response.data.toolsCalled);
    console.log('Processing time:', response.data.processingTime);
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    }
  }
}

quickTest();