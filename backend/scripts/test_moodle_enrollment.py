import os
import sys
import secrets
from datetime import datetime

# Add backend root to path so we can import app modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.moodle_service import ASSESSMENT_COURSE_MAP, get_moodle_service


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
    power_platform_course_id = ASSESSMENT_COURSE_MAP["POWER_PLATFORM"]

    print("=" * 60)
    print("MOODLE ENROLLMENT TEST")
    print("=" * 60)

    moodle = get_moodle_service()
    print(f"Moodle URL: {moodle.moodle_url}")
    print(f"Target course: Power Platform Assessment (ID {power_platform_course_id})")

    site_info = moodle.get_site_info()
    print_result("1. Site Info / Connectivity", site_info)

    if not site_info.success:
        print("\nConnectivity test failed. Aborting enrollment test.")
        return 1

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    username = f"ats_enroll_{timestamp}"
    password = f"AtsTest#{secrets.token_hex(8)}"
    email = f"{username}@example.com"

    create_result = moodle.create_user(
        username=username,
        password=password,
        firstname="ATS",
        lastname="EnrollTest",
        email=email,
    )
    print_result("2. Create User", create_result)

    if not create_result.success or not isinstance(create_result.data, list):
        print("\nUser creation failed. Aborting enrollment test.")
        return 1

    moodle_user_id = create_result.data[0]["id"]

    enroll_result = moodle.enroll_user(
        moodle_user_id=moodle_user_id,
        course_id=power_platform_course_id,
    )
    print_result("3. Enroll User", enroll_result)

    if enroll_result.success:
        print("\nEnrollment summary:")
        print(f"  Moodle user ID: {moodle_user_id}")
        print(f"  Username:       {username}")
        print(f"  Course ID:      {power_platform_course_id}")
        print(f"  Already enrolled: {enroll_result.data.get('already_enrolled', False)}")
        print("\nVerify in Moodle UI:")
        print("  Power Platform Assessment -> Participants")
        print("\nAll tests passed.")
        return 0

    print("\nEnrollment failed.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
