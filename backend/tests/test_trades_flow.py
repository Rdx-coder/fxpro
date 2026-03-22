def test_trade_execute_and_close_flow(client, user_auth, admin_token):
    _, user_headers = user_auth("t1@example.com", "TradePass123!")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    profile = client.get("/api/profile", headers=user_headers)
    user_id = profile.json()["id"]

    fund = client.post(
        "/api/admin/users/wallet",
        json={"userId": user_id, "action": "add", "amount": 1000.0, "note": "seed"},
        headers=admin_headers,
    )
    assert fund.status_code == 200, fund.text

    before = client.get("/api/wallet/balance", headers=user_headers).json()["balance"]

    execute = client.post(
        "/api/trades/execute",
        json={"symbol": "BTC/USD", "type": "buy", "quantity": 0.1, "leverage": 20},
        headers=user_headers,
    )
    assert execute.status_code == 200, execute.text
    trade_id = execute.json()["id"]

    after_execute = client.get("/api/wallet/balance", headers=user_headers).json()["balance"]
    assert after_execute < before

    open_trades = client.get("/api/trades/open", headers=user_headers)
    assert open_trades.status_code == 200, open_trades.text
    assert len(open_trades.json()) >= 1

    close = client.post(f"/api/trades/{trade_id}/close", headers=user_headers)
    assert close.status_code == 200, close.text

    history = client.get("/api/trades/history", headers=user_headers)
    assert history.status_code == 200, history.text
    assert len(history.json()) >= 1


def test_admin_trade_crud_flow(client, user_auth, admin_token):
    _, user_headers = user_auth("t2@example.com", "TradePass123!")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    profile = client.get("/api/profile", headers=user_headers)
    user_id = profile.json()["id"]

    fund = client.post(
        "/api/admin/users/wallet",
        json={"userId": user_id, "action": "add", "amount": 5000.0, "note": "seed"},
        headers=admin_headers,
    )
    assert fund.status_code == 200, fund.text

    create_trade = client.post(
        "/api/admin/trades/create",
        json={
            "userId": user_id,
            "symbol": "ETH/USD",
            "type": "sell",
            "entryPrice": 2500.0,
            "quantity": 0.5,
            "leverage": 10,
        },
        headers=admin_headers,
    )
    assert create_trade.status_code == 200, create_trade.text
    trade_id = create_trade.json()["id"]

    update_trade = client.put(
        f"/api/admin/trades/{trade_id}",
        json={"takeProfit": 2400.0},
        headers=admin_headers,
    )
    assert update_trade.status_code == 200, update_trade.text

    close_trade = client.post(
        f"/api/admin/trades/{trade_id}/close",
        json={"exitPrice": 2450.0},
        headers=admin_headers,
    )
    assert close_trade.status_code == 200, close_trade.text
