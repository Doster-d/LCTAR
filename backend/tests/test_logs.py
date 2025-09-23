def token(client):
    client.post(
        '/auth/register',
        json={'email': 'loguser@example.com', 'password': 'pass123'},
    )
    r = client.post(
        '/auth/login',
        json={'email': 'loguser@example.com', 'password': 'pass123'},
    )
    return r.json()['access_token']


def test_submit_log(client):
    t = token(client)
    r = client.post(
        '/logs/',
        json={'level': 'info', 'message': 'hello', 'context': 'ctx'},
        headers={'Authorization': f'Bearer {t}'},
    )
    assert r.status_code == 200
    data = r.json()
    assert data['level'] == 'INFO'
