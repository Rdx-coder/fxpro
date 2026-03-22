#!/usr/bin/env python3
"""
Debug specific failing endpoints
"""
import requests
import json

BASE_URL = "https://wallet-sync-lab.preview.emergentagent.com/api"

def test_endpoint(endpoint, headers=None):
    """Test a specific endpoint and show detailed response"""
    try:
        response = requests.get(f"{BASE_URL}{endpoint}", headers=headers, timeout=10)
        print(f"\n🔍 Testing: {endpoint}")
        print(f"Status: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        print(f"Raw Content: {response.text[:500]}...")  # First 500 chars
        
        try:
            json_data = response.json()
            print(f"JSON: {json_data}")
        except json.JSONDecodeError as e:
            print(f"JSON Decode Error: {e}")
            
    except Exception as e:
        print(f"Request Error: {e}")

# Test the problematic endpoints
test_endpoint("/market/quotes")
test_endpoint("/market/price/BTCUSDT")

# Test with auth headers for deposits
auth_headers = {"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OWJiZGQ3OWU0OWE3YTYyYzAwYzUxNTkiLCJyb2xlIjoidXNlciIsImV4cCI6MTc0MTk5NTc5N30.hqy_t_MJJGw-bgpDtFP5D64nHdOTzRY_AYfIL2B9A8o"}  # Using token from previous test
test_endpoint("/deposits", auth_headers)