import os
import sys
import secrets
from datetime import datetime

# Add backend root to path so we can import app modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.moodle_service import get_moodle_service


def print_result(label: str, result) -> None:
    print(f"\n{label}")
    print("-" * len(label))
    print(f"Success: {result.success}")
    if result.success:
        print(f"Data: {result.data}")
    else:
        print(f"Error: {result.error}")
        if result.error_code:
            print(f"Error code: {result.error_code}")


def main() -> int:
    print("=" * 60)
    print("MOODLE CONNECTION TEST")
    print("=" * 60)

    moodle = get_moodle_service()
    print(f"Moodle URL: {moodle.moodle_url}")

    site_info = moodle.get_site_info()
    print_result("1. Site Info / Connectivity", site_info)

    if not site_info.success:
        print("\nConnectivity test failed. Aborting user creation.")
        return 1

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    username = f"ats_test_{timestamp}"
    password = f"AtsTest#{secrets.token_hex(8)}"
    email = f"{username}@example.com"

    create_result = moodle.create_user(
        username=username,
        password=password,
        firstname="ATS",
        lastname="TestUser",
        email=email,
    )
    print_result("2. Create User", create_result)

    if create_result.success:
        print("\nCreated user credentials (for Moodle UI verification):")
        print(f"  Username: {username}")
        print(f"  Password: {password}")
        print(f"  Email:    {email}")
        print("\nAll tests passed.")
        return 0

    print("\nUser creation failed.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
