def test_register_login_profile_flow(client):
    register = client.post(
        "/api/auth/register",
        json={
            "name": "Rahul",
            "email": "rahul@example.com",
            "password": "RahulStrong123!",
        },
    )
    assert register.status_code == 200, register.text
    token = register.json()["token"]

    login = client.post(
        "/api/auth/login",
        json={"email": "rahul@example.com", "password": "RahulStrong123!"},
    )
    assert login.status_code == 200, login.text

    profile = client.get(
        "/api/profile",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert profile.status_code == 200, profile.text
    body = profile.json()
    assert body["email"] == "rahul@example.com"
    assert body["name"] == "Rahul"


def test_profile_requires_auth(client):
    res = client.get("/api/profile")
    assert res.status_code in {401, 403}


def test_admin_endpoint_denies_normal_user(client, user_auth):
    _, user_headers = user_auth("normal@example.com", "NormalPass123!")
    res = client.get("/api/admin/dashboard", headers=user_headers)
    assert res.status_code == 403
