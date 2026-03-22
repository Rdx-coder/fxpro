def _bank_payload():
    return {
        "accountName": "Rahul D",
        "accountNumber": "1234567890",
        "iban": "DE12345678901234567890",
        "swiftCode": "ABCDEFGH",
        "bankName": "Test Bank",
        "bankAddress": "Main Street 1",
        "isDefault": True,
    }


def test_withdrawal_insufficient_balance(client, user_auth):
    _, user_headers = user_auth("w1@example.com", "WithdrawPass123!")

    bank = client.post("/api/bank-accounts", json=_bank_payload(), headers=user_headers)
    assert bank.status_code == 200, bank.text
    bank_id = bank.json()["id"]

    withdraw = client.post(
        "/api/withdrawals",
        json={"amount": 100.0, "bankAccountId": bank_id},
        headers=user_headers,
    )
    assert withdraw.status_code == 400
    assert "Insufficient balance" in withdraw.text


def test_deposit_approve_updates_wallet(client, user_auth, admin_token):
    _, user_headers = user_auth("d1@example.com", "DepositPass123!")

    deposit = client.post(
        "/api/deposits",
        json={"amount": 250.0, "method": "upi", "screenshot": "a" * 64},
        headers=user_headers,
    )
    assert deposit.status_code == 200, deposit.text
    deposit_id = deposit.json()["id"]

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    approve = client.post(
        "/api/admin/deposits/review",
        json={"depositId": deposit_id, "action": "approve", "note": "ok"},
        headers=admin_headers,
    )
    assert approve.status_code == 200, approve.text

    balance = client.get("/api/wallet/balance", headers=user_headers)
    assert balance.status_code == 200, balance.text
    assert balance.json()["balance"] == 250.0


def test_withdrawal_reject_refunds_balance(client, user_auth, admin_token):
    _, user_headers = user_auth("w2@example.com", "WithdrawPass123!")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    user_profile = client.get("/api/profile", headers=user_headers)
    user_id = user_profile.json()["id"]

    top_up = client.post(
        "/api/admin/users/wallet",
        json={"userId": user_id, "action": "add", "amount": 500.0, "note": "test"},
        headers=admin_headers,
    )
    assert top_up.status_code == 200, top_up.text

    bank = client.post("/api/bank-accounts", json=_bank_payload(), headers=user_headers)
    bank_id = bank.json()["id"]

    withdraw = client.post(
        "/api/withdrawals",
        json={"amount": 200.0, "bankAccountId": bank_id},
        headers=user_headers,
    )
    assert withdraw.status_code == 200, withdraw.text
    withdrawal_id = withdraw.json()["id"]

    reject = client.post(
        "/api/admin/withdrawals/review",
        json={"withdrawalId": withdrawal_id, "action": "reject", "note": "retry"},
        headers=admin_headers,
    )
    assert reject.status_code == 200, reject.text

    balance = client.get("/api/wallet/balance", headers=user_headers)
    assert balance.status_code == 200
    assert balance.json()["balance"] == 500.0
