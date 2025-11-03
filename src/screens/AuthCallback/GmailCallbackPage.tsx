import React, { useEffect } from 'react';

const GmailCallbackPage = () => {
  useEffect(() => {
    // Send a message to the parent window to indicate that the auth was successful
    if (window.opener) {
      window.opener.postMessage('gmail-auth-success', window.location.origin);
    }
    // Close the popup window
    window.close();
  }, []);

  return (
    <div>
      <h1>Authenticating...</h1>
      <p>Please wait while we connect your Gmail account.</p>
    </div>
  );
};

export default GmailCallbackPage;