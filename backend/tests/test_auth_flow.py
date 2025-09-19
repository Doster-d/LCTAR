def test_register_and_login(client):
    r = client.post('/auth/register', json={'email': 'u1@example.com', 'password': 'pass123'})
    assert r.status_code == 200
    r2 = client.post('/auth/login', json={'email': 'u1@example.com', 'password': 'pass123'})
    assert r2.status_code == 200
    token = r2.json()['access_token']
    assert token
