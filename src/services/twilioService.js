const twilio = require('twilio');
const config = require('../config');

function createClient() {
  if (!config.twilioAccountSid || !config.twilioAuthToken) {
    throw new Error('Twilio credentials are missing');
  }

  return twilio(config.twilioAccountSid, config.twilioAuthToken);
}

async function makeOutboundCall(toNumber) {
  if (!config.twilioPhoneNumber) {
    throw new Error('TWILIO_PHONE_NUMBER is missing');
  }

  const publicBaseUrl = (config.publicUrl || '').replace(/\/$/, '');
  if (!publicBaseUrl) {
    throw new Error('PUBLIC_URL is not set – cannot create outbound call without a reachable webhook URL');
  }

  if (!toNumber) {
    throw new Error('No phone number specified for outbound call');
  }
  const to = toNumber;
  const client = createClient();

  return client.calls.create({
    to,
    from: config.twilioPhoneNumber,
    url: `${publicBaseUrl}/api/call/incoming`,
    method: 'POST',
    statusCallback: `${publicBaseUrl}/api/call/status`,
    statusCallbackMethod: 'POST',
    statusCallbackEvent: ['completed', 'canceled', 'failed', 'busy', 'no-answer']
  });
}

// Call multiple numbers at once
async function makeMultipleCalls(numbers) {
  const results = [];
  for (const num of numbers) {
    try {
      const call = await makeOutboundCall(num);
      results.push({ to: num, success: true, callSid: call.sid });
    } catch (err) {
      results.push({ to: num, success: false, error: err.message });
    }
  }
  return results;
}

module.exports = {
  makeOutboundCall,
  makeMultipleCalls
};
