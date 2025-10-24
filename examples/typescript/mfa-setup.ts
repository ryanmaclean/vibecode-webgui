/**
 * MFA Setup Example - TypeScript SDK
 *
 * Demonstrates multi-factor authentication:
 * - Setting up TOTP (authenticator app)
 * - Setting up SMS-based MFA
 * - Verifying MFA devices
 * - Managing backup codes
 */

import { createVibeCodeClient } from '@vibecode/client';
import * as readline from 'readline';

// Helper function to get user input
function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const client = createVibeCodeClient({
    baseUrl: process.env.VIBECODE_API_URL || 'http://localhost:3000/api',
    token: process.env.VIBECODE_TOKEN,
  });

  await client.init();

  try {
    console.log('=== VibeCode MFA Setup Demo ===\n');

    // Example 1: Setup TOTP MFA
    console.log('Example 1: Setting up TOTP (Authenticator App) MFA...\n');

    const totpSetup = await client.setupMFA({
      type: 'totp',
      name: 'My Authenticator App',
    });

    console.log('TOTP MFA Setup Successful!');
    console.log(`Device ID: ${totpSetup.deviceId}`);
    console.log('\nQR Code (base64):');
    console.log(totpSetup.qrCode);
    console.log('\nBackup Codes (SAVE THESE SECURELY):');
    totpSetup.backupCodes?.forEach((code, index) => {
      console.log(`  ${index + 1}. ${code}`);
    });

    // In a real application, you would:
    // 1. Display the QR code for the user to scan
    // 2. Wait for them to enter the 6-digit code from their app
    // 3. Verify the code

    const totpCode = await askQuestion(
      '\nEnter the 6-digit code from your authenticator app: '
    );

    if (totpCode && totpSetup.setupToken) {
      try {
        const verification = await client.verifyMFA({
          deviceId: totpSetup.deviceId || '',
          token: totpCode,
          setupToken: totpSetup.setupToken,
        });

        console.log('\n✓ TOTP MFA Verified Successfully!');
        console.log('Device:', verification.device);
      } catch (error) {
        console.error('\n✗ Verification failed. Please try again.');
      }
    }

    // Example 2: Setup SMS MFA
    console.log('\n\nExample 2: Setting up SMS MFA...\n');

    const phoneNumber = await askQuestion('Enter your phone number (E.164 format, e.g., +1234567890): ');

    if (phoneNumber) {
      const smsSetup = await client.setupMFA({
        type: 'sms',
        name: 'My Phone',
        phoneNumber,
      });

      console.log('\nSMS MFA Setup Initiated!');
      console.log(`Device ID: ${smsSetup.deviceId}`);
      console.log('A verification code has been sent to your phone.');

      const smsCode = await askQuestion('\nEnter the code from the SMS: ');

      if (smsCode && smsSetup.setupToken) {
        try {
          const smsVerification = await client.verifyMFA({
            deviceId: smsSetup.deviceId || '',
            token: smsCode,
            setupToken: smsSetup.setupToken,
          });

          console.log('\n✓ SMS MFA Verified Successfully!');
          console.log('Device:', smsVerification.device);
        } catch (error) {
          console.error('\n✗ SMS verification failed.');
        }
      }
    }

    // Example 3: Setup Email MFA
    console.log('\n\nExample 3: Setting up Email MFA...\n');

    const email = await askQuestion('Enter your email address: ');

    if (email) {
      const emailSetup = await client.setupMFA({
        type: 'email',
        name: 'My Email',
        email,
      });

      console.log('\nEmail MFA Setup Initiated!');
      console.log(`Device ID: ${emailSetup.deviceId}`);
      console.log('A verification code has been sent to your email.');

      const emailCode = await askQuestion('\nEnter the code from the email: ');

      if (emailCode && emailSetup.setupToken) {
        try {
          const emailVerification = await client.verifyMFA({
            deviceId: emailSetup.deviceId || '',
            token: emailCode,
            setupToken: emailSetup.setupToken,
          });

          console.log('\n✓ Email MFA Verified Successfully!');
          console.log('Device:', emailVerification.device);
        } catch (error) {
          console.error('\n✗ Email verification failed.');
        }
      }
    }

    console.log('\n\n=== MFA Setup Complete ===');
    console.log('\nBest Practices:');
    console.log('1. Store backup codes in a secure location');
    console.log('2. Use a password manager or encrypted storage');
    console.log('3. Never share your MFA codes or backup codes');
    console.log('4. Set up multiple MFA methods as backup');
    console.log('5. Test your MFA setup before relying on it');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
