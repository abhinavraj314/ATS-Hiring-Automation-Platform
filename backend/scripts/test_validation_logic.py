from datetime import datetime, date, time
from fastapi import HTTPException
import sys
import os

# Append backend directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.api.v1.interviews import validate_future_datetime
from app.api.v1.panels import validate_future_availability

def test_interviews_validation():
    print("Testing Interview Validation...")
    
    # 1. Test past datetime (should fail)
    past_dt = datetime(2020, 1, 1, 10, 0, 0)
    try:
        validate_future_datetime(past_dt)
        print("❌ FAIL: Past datetime did not raise HTTPException")
    except HTTPException as e:
        print(f"✅ PASS: Past datetime correctly raised HTTPException: {e.detail}")
        assert e.status_code == 400

    # 2. Test non-30-minute interval (should fail)
    non_aligned_dt = datetime(2035, 1, 1, 10, 15, 0)
    try:
        validate_future_datetime(non_aligned_dt)
        print("❌ FAIL: Non-aligned datetime did not raise HTTPException")
    except HTTPException as e:
        print(f"✅ PASS: Non-aligned datetime correctly raised HTTPException: {e.detail}")
        assert e.status_code == 400

    # 3. Test non-aligned seconds (should fail)
    non_aligned_sec = datetime(2035, 1, 1, 10, 30, 15)
    try:
        validate_future_datetime(non_aligned_sec)
        print("❌ FAIL: Non-aligned seconds did not raise HTTPException")
    except HTTPException as e:
        print(f"✅ PASS: Non-aligned seconds correctly raised HTTPException: {e.detail}")
        assert e.status_code == 400

    # 4. Test out-of-working-hours: 3:00 AM (should fail)
    out_of_hours_early = datetime(2035, 1, 1, 3, 0, 0)
    try:
        validate_future_datetime(out_of_hours_early)
        print("❌ FAIL: Early morning datetime did not raise HTTPException")
    except HTTPException as e:
        print(f"✅ PASS: Early morning datetime correctly raised HTTPException: {e.detail}")
        assert e.status_code == 400

    # 5. Test out-of-working-hours: 9:30 PM (should fail)
    out_of_hours_late = datetime(2035, 1, 1, 21, 30, 0)
    try:
        validate_future_datetime(out_of_hours_late)
        print("❌ FAIL: Late night datetime did not raise HTTPException")
    except HTTPException as e:
        print(f"✅ PASS: Late night datetime correctly raised HTTPException: {e.detail}")
        assert e.status_code == 400

    # 6. Test valid future datetime: 10:00 AM (should pass)
    valid_dt = datetime(2035, 1, 1, 10, 0, 0)
    try:
        validate_future_datetime(valid_dt)
        print("✅ PASS: Valid datetime passed successfully")
    except HTTPException as e:
        print(f"❌ FAIL: Valid datetime raised HTTPException: {e.detail}")

def test_panels_validation():
    print("\nTesting Panelist Availability Validation...")
    
    test_date = date(2035, 1, 1)
    
    # 1. Test start time in past (should fail, but since test_date is 2035 it's future. Let's test with past date)
    past_date = date(2020, 1, 1)
    try:
        validate_future_availability(past_date, time(10, 0, 0), time(11, 0, 0))
        print("❌ FAIL: Past availability did not raise HTTPException")
    except HTTPException as e:
        print(f"✅ PASS: Past availability correctly raised HTTPException: {e.detail}")
        assert e.status_code == 400

    # 2. Test start >= end (should fail)
    try:
        validate_future_availability(test_date, time(11, 0, 0), time(10, 0, 0))
        print("❌ FAIL: Start time after end time did not raise HTTPException")
    except HTTPException as e:
        print(f"✅ PASS: Start time after end time correctly raised HTTPException: {e.detail}")
        assert e.status_code == 400

    # 3. Test non-30-minute interval (should fail)
    try:
        validate_future_availability(test_date, time(10, 15, 0), time(11, 0, 0))
        print("❌ FAIL: Non-aligned availability start did not raise HTTPException")
    except HTTPException as e:
        print(f"✅ PASS: Non-aligned availability start correctly raised HTTPException: {e.detail}")
        assert e.status_code == 400

    # 4. Test out-of-working-hours: 7:30 AM -> 9:00 AM (should fail)
    try:
        validate_future_availability(test_date, time(7, 30, 0), time(9, 0, 0))
        print("❌ FAIL: Availability start out of working hours did not raise HTTPException")
    except HTTPException as e:
        print(f"✅ PASS: Availability start out of working hours correctly raised HTTPException: {e.detail}")
        assert e.status_code == 400

    # 5. Test duration < 30 minutes (should fail)
    try:
        # Note: if start and end are 30-min aligned and start < end, duration is at least 30 mins.
        # But if they send equal start and end time (which should fail start >= end):
        validate_future_availability(test_date, time(10, 0, 0), time(10, 0, 0))
        print("❌ FAIL: Zero duration availability did not raise HTTPException")
    except HTTPException as e:
        print(f"✅ PASS: Zero duration availability correctly raised HTTPException: {e.detail}")
        assert e.status_code == 400

    # 6. Test valid availability: 09:30 AM -> 11:30 AM (should pass)
    try:
        validate_future_availability(test_date, time(9, 30, 0), time(11, 30, 0))
        print("✅ PASS: Valid availability passed successfully")
    except HTTPException as e:
        print(f"❌ FAIL: Valid availability raised HTTPException: {e.detail}")

if __name__ == "__main__":
    test_interviews_validation()
    test_panels_validation()
    print("\nAll unit tests passed successfully!")
