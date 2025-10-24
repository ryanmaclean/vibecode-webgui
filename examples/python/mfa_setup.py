"""
MFA Setup Example - Python SDK

Demonstrates multi-factor authentication:
- Setting up TOTP (authenticator app)
- Setting up SMS-based MFA
- Verifying MFA devices
- Managing backup codes
"""

import asyncio
import os

from vibecode_client import VibeCodeClient


def get_input(prompt: str) -> str:
    """Get user input with a prompt."""
    return input(prompt)


async def main():
    """Main function demonstrating MFA setup."""

    async with VibeCodeClient(
        base_url=os.getenv("VIBECODE_API_URL", "http://localhost:3000/api"),
        token=os.getenv("VIBECODE_TOKEN"),
    ) as client:
        try:
            print("=== VibeCode MFA Setup Demo ===\n")

            # Example 1: Setup TOTP MFA
            print("Example 1: Setting up TOTP (Authenticator App) MFA...\n")

            totp_setup = await client.setup_mfa(
                mfa_type="totp",
                name="My Authenticator App",
            )

            print("TOTP MFA Setup Successful!")
            print(f"Device ID: {totp_setup['deviceId']}")
            print("\nQR Code (base64):")
            print(totp_setup["qrCode"])
            print("\nBackup Codes (SAVE THESE SECURELY):")
            for index, code in enumerate(totp_setup.get("backupCodes", []), 1):
                print(f"  {index}. {code}")

            # In a real application, you would:
            # 1. Display the QR code for the user to scan
            # 2. Wait for them to enter the 6-digit code from their app
            # 3. Verify the code

            totp_code = get_input(
                "\nEnter the 6-digit code from your authenticator app: "
            )

            if totp_code and totp_setup.get("setupToken"):
                try:
                    verification = await client.verify_mfa(
                        device_id=totp_setup["deviceId"],
                        token=totp_code,
                        setup_token=totp_setup["setupToken"],
                    )

                    print("\n✓ TOTP MFA Verified Successfully!")
                    print(f"Device: {verification['device']}")
                except Exception as e:
                    print(f"\n✗ Verification failed: {e}")

            # Example 2: Setup SMS MFA
            print("\n\nExample 2: Setting up SMS MFA...\n")

            phone_number = get_input(
                "Enter your phone number (E.164 format, e.g., +1234567890): "
            )

            if phone_number:
                sms_setup = await client.setup_mfa(
                    mfa_type="sms",
                    name="My Phone",
                    phone_number=phone_number,
                )

                print("\nSMS MFA Setup Initiated!")
                print(f"Device ID: {sms_setup['deviceId']}")
                print("A verification code has been sent to your phone.")

                sms_code = get_input("\nEnter the code from the SMS: ")

                if sms_code and sms_setup.get("setupToken"):
                    try:
                        sms_verification = await client.verify_mfa(
                            device_id=sms_setup["deviceId"],
                            token=sms_code,
                            setup_token=sms_setup["setupToken"],
                        )

                        print("\n✓ SMS MFA Verified Successfully!")
                        print(f"Device: {sms_verification['device']}")
                    except Exception as e:
                        print(f"\n✗ SMS verification failed: {e}")

            # Example 3: Setup Email MFA
            print("\n\nExample 3: Setting up Email MFA...\n")

            email = get_input("Enter your email address: ")

            if email:
                email_setup = await client.setup_mfa(
                    mfa_type="email",
                    name="My Email",
                    email=email,
                )

                print("\nEmail MFA Setup Initiated!")
                print(f"Device ID: {email_setup['deviceId']}")
                print("A verification code has been sent to your email.")

                email_code = get_input("\nEnter the code from the email: ")

                if email_code and email_setup.get("setupToken"):
                    try:
                        email_verification = await client.verify_mfa(
                            device_id=email_setup["deviceId"],
                            token=email_code,
                            setup_token=email_setup["setupToken"],
                        )

                        print("\n✓ Email MFA Verified Successfully!")
                        print(f"Device: {email_verification['device']}")
                    except Exception as e:
                        print(f"\n✗ Email verification failed: {e}")

            print("\n\n=== MFA Setup Complete ===")
            print("\nBest Practices:")
            print("1. Store backup codes in a secure location")
            print("2. Use a password manager or encrypted storage")
            print("3. Never share your MFA codes or backup codes")
            print("4. Set up multiple MFA methods as backup")
            print("5. Test your MFA setup before relying on it")

        except Exception as e:
            print(f"Error: {e}")
            return 1

    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)
