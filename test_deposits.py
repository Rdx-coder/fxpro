#!/usr/bin/env python3
"""
Test deposits with fresh authentication 
"""
import requests
import base64

BASE_URL = "https://wallet-sync-lab.preview.emergentagent.com/api"

def get_new_auth_token():
    """Get fresh auth token"""
    user_data = {
        "name": "Jane Doe",
        "email": "jane.doe@example.com", 
        "password": "TestPassword123!"
    }
    response = requests.post(f"{BASE_URL}/auth/register", json=user_data)
    if response.status_code == 200:
        return response.json()["token"]
    
    # Try login if registration fails
    login_data = {"email": user_data["email"], "password": user_data["password"]}
    response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
    if response.status_code == 200:
        return response.json()["token"]
    return None

def test_deposits_with_fresh_token():
    """Test deposits with fresh token"""
    token = get_new_auth_token()
    if not token:
        print("❌ Failed to get auth token")
        return
        
    print(f"✅ Got auth token: {token[:50]}...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test get deposits 
    print("\n🔍 Testing GET /deposits")
    response = requests.get(f"{BASE_URL}/deposits", headers=headers)
    print(f"Status: {response.status_code}")
    print(f"Content: {response.text[:200]}...")
    
    # Create a deposit first
    print("\n🔍 Creating deposit...")
    dummy_screenshot = base64.b64encode(b"fake_screenshot").decode()
    deposit_data = {
        "amount": 50.00,
        "method": "upi",
        "screenshot": dummy_screenshot
    }
    
    response = requests.post(f"{BASE_URL}/deposits", json=deposit_data, headers=headers)
    print(f"Create Status: {response.status_code}")
    if response.status_code == 200:
        print(f"Create Response: {response.json()}")
        
        # Now test get deposits again
        print("\n🔍 Testing GET /deposits after creation")
        response = requests.get(f"{BASE_URL}/deposits", headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Content: {response.text[:500]}...")
    else:
        print(f"Create Error: {response.text}")

if __name__ == "__main__":
    test_deposits_with_fresh_token()