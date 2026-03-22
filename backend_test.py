#!/usr/bin/env python3
"""
Backend API Tests for FxPro Trading Application
Tests all critical backend flows including authentication, market data, deposits, trading, and admin functions.
"""

import requests
import json
import base64
import time
from typing import Dict, Any, Optional

# Configuration - using production URL from frontend env
BASE_URL = "https://wallet-sync-lab.preview.emergentagent.com/api"

# Test data
TEST_USER = {
    "name": "John Trader",
    "email": "john.trader@example.com", 
    "password": "SecurePassword123!"
}

ADMIN_CREDENTIALS = {
    "email": "admin@fxpro.com",
    "password": "ankit@123456"
}

class FxProAPITester:
    def __init__(self):
        self.user_token = None
        self.admin_token = None
        self.user_id = None
        self.test_results = {}
        
    def log_test(self, test_name: str, success: bool, message: str, response_data: Any = None):
        """Log test results"""
        self.test_results[test_name] = {
            "success": success,
            "message": message,
            "response_data": response_data
        }
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if not success and response_data:
            print(f"    Response: {response_data}")
            
    def make_request(self, method: str, endpoint: str, data: Dict = None, headers: Dict = None) -> tuple:
        """Make HTTP request and return response"""
        url = f"{BASE_URL}{endpoint}"
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, timeout=10)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method.upper() == "PUT":
                response = requests.put(url, json=data, headers=headers, timeout=10)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
                
            return response.status_code, response.json() if response.content else {}
        except requests.exceptions.RequestException as e:
            return 500, {"error": str(e)}
        except json.JSONDecodeError:
            return response.status_code, {"error": "Invalid JSON response"}
            
    def get_auth_headers(self, token: str) -> Dict:
        """Get authorization headers"""
        return {"Authorization": f"Bearer {token}"}
        
    # ==================== HEALTH CHECK ====================
    def test_health_check(self):
        """Test health endpoint"""
        status_code, response = self.make_request("GET", "/health")
        
        if status_code == 200 and response.get("status") == "ok":
            self.log_test("Health Check", True, "API is healthy")
        else:
            self.log_test("Health Check", False, f"Health check failed: {status_code}", response)
            
    # ==================== AUTHENTICATION TESTS ====================
    def test_user_registration(self):
        """Test user registration"""
        status_code, response = self.make_request("POST", "/auth/register", TEST_USER)
        
        if status_code == 200 and "token" in response and "user" in response:
            self.user_token = response["token"]
            self.user_id = response["user"]["id"]
            self.log_test("User Registration", True, f"User registered successfully with ID: {self.user_id}")
        else:
            self.log_test("User Registration", False, f"Registration failed: {status_code}", response)
            
    def test_user_login(self):
        """Test user login"""
        login_data = {
            "email": TEST_USER["email"],
            "password": TEST_USER["password"]
        }
        status_code, response = self.make_request("POST", "/auth/login", login_data)
        
        if status_code == 200 and "token" in response:
            if not self.user_token:  # Only set if not already set from registration
                self.user_token = response["token"]
                self.user_id = response["user"]["id"]
            self.log_test("User Login", True, "User logged in successfully")
        else:
            self.log_test("User Login", False, f"Login failed: {status_code}", response)
            
    def test_admin_login(self):
        """Test admin login"""
        status_code, response = self.make_request("POST", "/auth/login", ADMIN_CREDENTIALS)
        
        if status_code == 200 and "token" in response:
            self.admin_token = response["token"]
            user_role = response.get("user", {}).get("role")
            if user_role == "admin":
                self.log_test("Admin Login", True, "Admin logged in successfully")
            else:
                self.log_test("Admin Login", False, f"User role is not admin: {user_role}", response)
        else:
            self.log_test("Admin Login", False, f"Admin login failed: {status_code}", response)
            
    # ==================== MARKET DATA TESTS ====================
    def test_market_quotes(self):
        """Test market quotes (no auth required)"""
        status_code, response = self.make_request("GET", "/market/quotes")
        
        if status_code == 200 and isinstance(response, list) and len(response) > 0:
            # Check if first quote has required fields
            first_quote = response[0]
            required_fields = ["symbol", "price", "change24h", "changePercent24h"]
            if all(field in first_quote for field in required_fields):
                self.log_test("Market Quotes", True, f"Retrieved {len(response)} market quotes")
            else:
                self.log_test("Market Quotes", False, "Missing required fields in quotes", first_quote)
        else:
            self.log_test("Market Quotes", False, f"Market quotes failed: {status_code}", response)
            
    def test_market_symbols(self):
        """Test market symbols"""
        status_code, response = self.make_request("GET", "/market/symbols")
        
        if status_code == 200 and "symbols" in response and len(response["symbols"]) > 0:
            symbols = response["symbols"]
            self.log_test("Market Symbols", True, f"Retrieved {len(symbols)} symbols")
        else:
            self.log_test("Market Symbols", False, f"Market symbols failed: {status_code}", response)
            
    def test_symbol_price(self):
        """Test specific symbol price - testing forex pairs"""
        # Test EUR/USD as mentioned in review request
        symbol = "EUR/USD"
        status_code, response = self.make_request("GET", f"/market/price/{symbol}")
        
        if status_code == 200 and "symbol" in response and "price" in response:
            price = response["price"]
            self.log_test("EUR/USD Price", True, f"EUR/USD rate: {price}")
        else:
            self.log_test("EUR/USD Price", False, f"EUR/USD price failed: {status_code}", response)
            
        # Test GBP/USD as mentioned in review request
        symbol = "GBP/USD"
        status_code, response = self.make_request("GET", f"/market/price/{symbol}")
        
        if status_code == 200 and "symbol" in response and "price" in response:
            price = response["price"]
            self.log_test("GBP/USD Price", True, f"GBP/USD rate: {price}")
        else:
            self.log_test("GBP/USD Price", False, f"GBP/USD price failed: {status_code}", response)
            
    # ==================== PROFILE TESTS ====================
    def test_user_profile(self):
        """Test user profile (requires auth)"""
        if not self.user_token:
            self.log_test("User Profile", False, "No user token available")
            return
            
        headers = self.get_auth_headers(self.user_token)
        status_code, response = self.make_request("GET", "/profile", headers=headers)
        
        if status_code == 200 and "id" in response and "email" in response:
            self.log_test("User Profile", True, f"Profile retrieved for user: {response['email']}")
        else:
            self.log_test("User Profile", False, f"Profile retrieval failed: {status_code}", response)
            
    def test_wallet_balance(self):
        """Test wallet balance"""
        if not self.user_token:
            self.log_test("Wallet Balance", False, "No user token available")
            return
            
        headers = self.get_auth_headers(self.user_token)
        status_code, response = self.make_request("GET", "/wallet/balance", headers=headers)
        
        if status_code == 200 and "balance" in response:
            balance = response["balance"]
            self.log_test("Wallet Balance", True, f"Current balance: ${balance}")
            return balance
        else:
            self.log_test("Wallet Balance", False, f"Balance retrieval failed: {status_code}", response)
            return None
            
    # ==================== DEPOSIT TESTS ====================
    def test_create_deposit(self):
        """Test deposit creation"""
        if not self.user_token:
            self.log_test("Create Deposit", False, "No user token available")
            return None
            
        # Create a dummy base64 screenshot
        dummy_screenshot = base64.b64encode(b"fake_screenshot_data").decode()
        
        deposit_data = {
            "amount": 100.00,
            "method": "upi",
            "screenshot": dummy_screenshot
        }
        
        headers = self.get_auth_headers(self.user_token)
        status_code, response = self.make_request("POST", "/deposits", deposit_data, headers)
        
        if status_code == 200 and "id" in response:
            deposit_id = response["id"]
            self.log_test("Create Deposit", True, f"Deposit created with ID: {deposit_id}")
            return deposit_id
        else:
            self.log_test("Create Deposit", False, f"Deposit creation failed: {status_code}", response)
            return None
            
    def test_get_deposits(self):
        """Test get user deposits"""
        if not self.user_token:
            self.log_test("Get Deposits", False, "No user token available")
            return
            
        headers = self.get_auth_headers(self.user_token)
        status_code, response = self.make_request("GET", "/deposits", headers=headers)
        
        if status_code == 200 and isinstance(response, list):
            self.log_test("Get Deposits", True, f"Retrieved {len(response)} deposits")
        else:
            self.log_test("Get Deposits", False, f"Get deposits failed: {status_code}", response)
            
    # ==================== ADMIN TESTS ====================
    def test_admin_dashboard(self):
        """Test admin dashboard"""
        if not self.admin_token:
            self.log_test("Admin Dashboard", False, "No admin token available")
            return
            
        headers = self.get_auth_headers(self.admin_token)
        status_code, response = self.make_request("GET", "/admin/dashboard", headers=headers)
        
        if status_code == 200:
            required_fields = ["totalUsers", "totalDeposits", "totalWithdrawals", "totalTrades"]
            if all(field in response for field in required_fields):
                self.log_test("Admin Dashboard", True, f"Dashboard stats retrieved: {response}")
            else:
                self.log_test("Admin Dashboard", False, "Missing required dashboard fields", response)
        else:
            self.log_test("Admin Dashboard", False, f"Admin dashboard failed: {status_code}", response)
            
    def test_admin_pending_deposits(self):
        """Test get pending deposits"""
        if not self.admin_token:
            self.log_test("Admin Pending Deposits", False, "No admin token available")
            return []
            
        headers = self.get_auth_headers(self.admin_token)
        status_code, response = self.make_request("GET", "/admin/deposits/pending", headers=headers)
        
        if status_code == 200 and isinstance(response, list):
            self.log_test("Admin Pending Deposits", True, f"Retrieved {len(response)} pending deposits")
            return response
        else:
            self.log_test("Admin Pending Deposits", False, f"Pending deposits failed: {status_code}", response)
            return []
            
    def test_admin_approve_deposit(self, deposit_id: str):
        """Test admin approve deposit"""
        if not self.admin_token or not deposit_id:
            self.log_test("Admin Approve Deposit", False, "No admin token or deposit ID available")
            return
            
        approve_data = {
            "depositId": deposit_id,
            "action": "approve",
            "note": "Approved by automated test"
        }
        
        headers = self.get_auth_headers(self.admin_token)
        status_code, response = self.make_request("POST", "/admin/deposits/review", approve_data, headers)
        
        if status_code == 200:
            self.log_test("Admin Approve Deposit", True, f"Deposit {deposit_id} approved successfully")
        else:
            self.log_test("Admin Approve Deposit", False, f"Deposit approval failed: {status_code}", response)
            
    def test_payment_settings(self):
        """Test payment settings (admin)"""
        if not self.admin_token:
            self.log_test("Payment Settings", False, "No admin token available")
            return
            
        headers = self.get_auth_headers(self.admin_token)
        
        # Get current settings
        status_code, response = self.make_request("GET", "/admin/payment-settings", headers=headers)
        
        if status_code == 200:
            self.log_test("Get Payment Settings", True, f"Payment settings retrieved: {response}")
            
            # Update settings
            update_data = {
                "upiId": "test@paytm",
                "qrCodeBase64": None
            }
            
            status_code, response = self.make_request("PUT", "/admin/payment-settings", update_data, headers)
            
            if status_code == 200:
                self.log_test("Update Payment Settings", True, "Payment settings updated successfully")
            else:
                self.log_test("Update Payment Settings", False, f"Settings update failed: {status_code}", response)
        else:
            self.log_test("Payment Settings", False, f"Get settings failed: {status_code}", response)
            
    # ==================== TRADING TESTS ====================
    def test_execute_trade(self):
        """Test trade execution (requires balance) - using forex pairs"""
        if not self.user_token:
            self.log_test("Execute Trade", False, "No user token available")
            return None
            
        # Check current balance first
        balance = self.test_wallet_balance()
        if balance is None or balance <= 0:
            self.log_test("Execute Trade", False, "Insufficient balance for trading")
            return None
            
        trade_data = {
            "symbol": "EUR/USD",  # Using forex pair as per Alpha Vantage integration
            "type": "buy",
            "quantity": 100,  # Smaller forex quantity - $100 worth at ~1.14 rate
            "leverage": 1.0
        }
        
        headers = self.get_auth_headers(self.user_token)
        status_code, response = self.make_request("POST", "/trades/execute", trade_data, headers)
        
        if status_code == 200 and "id" in response:
            trade_id = response["id"]
            entry_price = response.get("entryPrice")
            self.log_test("Execute Trade (EUR/USD)", True, f"Trade executed with ID: {trade_id}, Entry price: {entry_price}")
            return trade_id
        else:
            self.log_test("Execute Trade (EUR/USD)", False, f"Trade execution failed: {status_code}", response)
            return None
            
    def test_get_open_trades(self):
        """Test get open trades"""
        if not self.user_token:
            self.log_test("Get Open Trades", False, "No user token available")
            return []
            
        headers = self.get_auth_headers(self.user_token)
        status_code, response = self.make_request("GET", "/trades/open", headers=headers)
        
        if status_code == 200 and isinstance(response, list):
            self.log_test("Get Open Trades", True, f"Retrieved {len(response)} open trades")
            return response
        else:
            self.log_test("Get Open Trades", False, f"Get open trades failed: {status_code}", response)
            return []
            
    def test_close_trade(self, trade_id: str):
        """Test close trade"""
        if not self.user_token or not trade_id:
            self.log_test("Close Trade", False, "No user token or trade ID available")
            return
            
        headers = self.get_auth_headers(self.user_token)
        status_code, response = self.make_request("POST", f"/trades/{trade_id}/close", headers=headers)
        
        if status_code == 200:
            profit_loss = response.get("profitLoss", 0)
            self.log_test("Close Trade", True, f"Trade {trade_id} closed, P&L: ${profit_loss}")
        else:
            self.log_test("Close Trade", False, f"Trade closing failed: {status_code}", response)
            
    def test_trade_history(self):
        """Test get trade history"""
        if not self.user_token:
            self.log_test("Trade History", False, "No user token available")
            return
            
        headers = self.get_auth_headers(self.user_token)
        status_code, response = self.make_request("GET", "/trades/history", headers=headers)
        
        if status_code == 200 and isinstance(response, list):
            self.log_test("Trade History", True, f"Retrieved {len(response)} historical trades")
        else:
            self.log_test("Trade History", False, f"Trade history failed: {status_code}", response)
            
    # ==================== KYC & BANK ACCOUNT TESTS ====================
    def test_kyc_workflow(self):
        """Test KYC document upload and status check"""
        if not self.user_token:
            self.log_test("KYC Workflow", False, "No user token available")
            return
            
        headers = self.get_auth_headers(self.user_token)
        
        # Test KYC status
        status_code, response = self.make_request("GET", "/kyc/status", headers=headers)
        if status_code == 200 and "kycStatus" in response:
            self.log_test("KYC Status", True, f"KYC Status: {response['kycStatus']}")
        else:
            self.log_test("KYC Status", False, f"KYC status failed: {status_code}", response)
            
        # Test KYC documents list
        status_code, response = self.make_request("GET", "/kyc/documents", headers=headers)
        if status_code == 200 and isinstance(response, list):
            self.log_test("KYC Documents", True, f"Retrieved {len(response)} KYC documents")
        else:
            self.log_test("KYC Documents", False, f"KYC documents failed: {status_code}", response)
            
    def test_bank_accounts(self):
        """Test bank account creation and retrieval"""
        if not self.user_token:
            self.log_test("Bank Accounts", False, "No user token available")
            return None
            
        headers = self.get_auth_headers(self.user_token)
        
        # Create bank account
        bank_data = {
            "accountName": "John Trader",
            "accountNumber": "1234567890",
            "iban": "GB33BUKB20201555555555",
            "swiftCode": "BUKBGB22",
            "bankName": "Barclays Bank",
            "bankAddress": "1 Churchill Place, London E14 5HP, UK",
            "isDefault": True
        }
        
        status_code, response = self.make_request("POST", "/bank-accounts", bank_data, headers)
        bank_account_id = None
        
        if status_code == 200 and "id" in response:
            bank_account_id = response["id"]
            self.log_test("Create Bank Account", True, f"Bank account created with ID: {bank_account_id}")
        else:
            self.log_test("Create Bank Account", False, f"Bank account creation failed: {status_code}", response)
            
        # Get bank accounts
        status_code, response = self.make_request("GET", "/bank-accounts", headers=headers)
        if status_code == 200 and isinstance(response, list):
            self.log_test("Get Bank Accounts", True, f"Retrieved {len(response)} bank accounts")
        else:
            self.log_test("Get Bank Accounts", False, f"Get bank accounts failed: {status_code}", response)
            
        return bank_account_id
        
    # ==================== WITHDRAWAL TESTS ====================
    def test_withdrawal_workflow(self, bank_account_id: str):
        """Test withdrawal creation and retrieval"""
        if not self.user_token or not bank_account_id:
            self.log_test("Withdrawal Workflow", False, "No user token or bank account ID available")
            return
            
        headers = self.get_auth_headers(self.user_token)
        
        # Check balance first
        balance = self.test_wallet_balance()
        if balance is None or balance < 50:
            self.log_test("Withdrawal Workflow", False, "Insufficient balance for withdrawal test")
            return
            
        # Create withdrawal
        withdrawal_data = {
            "amount": 50.0,
            "bankAccountId": bank_account_id
        }
        
        status_code, response = self.make_request("POST", "/withdrawals", withdrawal_data, headers)
        
        if status_code == 200 and "id" in response:
            withdrawal_id = response["id"]
            self.log_test("Create Withdrawal", True, f"Withdrawal created with ID: {withdrawal_id}")
            
            # Get withdrawals
            status_code, response = self.make_request("GET", "/withdrawals", headers=headers)
            if status_code == 200 and isinstance(response, list):
                self.log_test("Get Withdrawals", True, f"Retrieved {len(response)} withdrawals")
            else:
                self.log_test("Get Withdrawals", False, f"Get withdrawals failed: {status_code}", response)
        else:
            self.log_test("Create Withdrawal", False, f"Withdrawal creation failed: {status_code}", response)
    def run_all_tests(self):
        """Run all tests in order"""
        print("🚀 Starting FxPro Trading Application Backend Tests...")
        print(f"Base URL: {BASE_URL}")
        print("=" * 60)
        
        # Health check first
        self.test_health_check()
        
        # Authentication tests
        print("\n📝 AUTHENTICATION TESTS")
        self.test_user_registration()
        self.test_user_login()  # Also tests existing user login
        self.test_admin_login()
        
        # Market data tests (no auth required)
        print("\n📊 MARKET DATA TESTS (Alpha Vantage)")
        self.test_market_quotes()
        self.test_market_symbols()
        self.test_symbol_price()  # Now tests EUR/USD and GBP/USD
        
        # Profile tests (requires auth)
        print("\n👤 PROFILE & WALLET TESTS")
        self.test_user_profile()
        initial_balance = self.test_wallet_balance()
        
        # KYC and Bank Account tests
        print("\n📄 KYC & BANK ACCOUNT TESTS")
        self.test_kyc_workflow()
        bank_account_id = self.test_bank_accounts()
        
        # Deposit workflow
        print("\n💰 DEPOSIT WORKFLOW TESTS")
        deposit_id = self.test_create_deposit()
        self.test_get_deposits()
        
        # Admin workflow
        print("\n⚙️ ADMIN WORKFLOW TESTS")
        self.test_admin_dashboard()
        pending_deposits = self.test_admin_pending_deposits()
        self.test_payment_settings()
        
        # Approve deposit if created
        if deposit_id:
            print("\n✅ ADMIN APPROVAL WORKFLOW")
            self.test_admin_approve_deposit(deposit_id)
            time.sleep(2)  # Wait for processing
            updated_balance = self.test_wallet_balance()
            
            if updated_balance and initial_balance is not None:
                if updated_balance > initial_balance:
                    self.log_test("Balance Update After Approval", True, 
                                f"Balance increased from ${initial_balance} to ${updated_balance}")
                else:
                    self.log_test("Balance Update After Approval", False, 
                                f"Balance did not increase: ${initial_balance} -> ${updated_balance}")
        
        # Withdrawal workflow
        if bank_account_id:
            print("\n💸 WITHDRAWAL WORKFLOW TESTS")
            self.test_withdrawal_workflow(bank_account_id)
        
        # Trading workflow (only if balance > 0)
        current_balance = self.test_wallet_balance()
        if current_balance and current_balance > 10:  # Minimum balance for trading
            print("\n📈 TRADING WORKFLOW TESTS (Forex)")
            trade_id = self.test_execute_trade()
            open_trades = self.test_get_open_trades()
            
            if trade_id:
                time.sleep(1)  # Wait for price changes
                self.test_close_trade(trade_id)
                
            self.test_trade_history()
        else:
            self.log_test("Trading Tests", False, "Insufficient balance for trading tests")
        
        # Print final results
        self.print_test_summary()
        
    def print_test_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("🏁 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results.values() if result["success"])
        total = len(self.test_results)
        failed = total - passed
        
        print(f"Total Tests: {total}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"Success Rate: {(passed/total*100):.1f}%")
        
        if failed > 0:
            print(f"\n❌ FAILED TESTS:")
            for test_name, result in self.test_results.items():
                if not result["success"]:
                    print(f"   • {test_name}: {result['message']}")
        else:
            print(f"\n🎉 All tests passed!")

if __name__ == "__main__":
    tester = FxProAPITester()
    tester.run_all_tests()