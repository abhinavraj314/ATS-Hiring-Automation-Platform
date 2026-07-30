import argparse
import os
import sys

# Add backend root to path so we can import app modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.moodle_service import ASSESSMENT_COURSE_MAP, PASS_THRESHOLD_PERCENTAGE, get_moodle_service


def print_grade_result(result) -> None:
    print("\nGrade Retrieval Result")
    print("-" * 22)
    print(f"Success: {result.success}")

    if not result.success:
        print(f"Error: {result.error}")
        if result.error_code:
            print(f"Error code: {result.error_code}")
        return

    grade = result.data
    print(f"Course ID:        {grade['course_id']}")
    print(f"User ID:          {grade['user_id']}")
    print(f"Assessment Name:  {grade['assessment_name']}")
    print(f"Score:            {grade['score'] if grade['score'] is not None else 'No attempt'}")
    print(f"Max Score:        {grade['max_score']}")
    if grade["percentage"] is not None:
        print(f"Percentage:       {grade['percentage']:.2f}%")
    else:
        print("Percentage:       N/A")
    print(f"Pass Threshold:   {PASS_THRESHOLD_PERCENTAGE:.0f}%")
    print(f"Passed:           {grade['passed']}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Retrieve Moodle assessment grades for a user")
    parser.add_argument(
        "--user-id",
        type=int,
        required=True,
        help="Moodle user ID",
    )
    parser.add_argument(
        "--course-id",
        type=int,
        default=ASSESSMENT_COURSE_MAP["POWER_PLATFORM"],
        help=f"Moodle course ID (default: Power Platform = {ASSESSMENT_COURSE_MAP['POWER_PLATFORM']})",
    )
    args = parser.parse_args()

    print("=" * 60)
    print("MOODLE GRADE RETRIEVAL TEST")
    print("=" * 60)

    moodle = get_moodle_service()
    print(f"Moodle URL: {moodle.moodle_url}")
    print(f"User ID:    {args.user_id}")
    print(f"Course ID:  {args.course_id}")

    site_info = moodle.get_site_info()
    if not site_info.success:
        print("\nConnectivity test failed. Aborting grade retrieval.")
        print(f"Error: {site_info.error}")
        return 1

    grade_result = moodle.get_user_grades(
        moodle_user_id=args.user_id,
        course_id=args.course_id,
    )
    print_grade_result(grade_result)

    if grade_result.success:
        print("\nGrade retrieval completed.")
        return 0

    print("\nGrade retrieval failed.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
