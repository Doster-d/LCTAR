def auth_token(client):
    client.post(
        '/auth/register',
        json={'email': 'vuser@example.com', 'password': 'pass123'},
    )
    r = client.post(
        '/auth/login',
        json={'email': 'vuser@example.com', 'password': 'pass123'},
    )
    return r.json()['access_token']


def test_video_upload_adds_score(client, tmp_path, monkeypatch):
    token = auth_token(client)
    video_bytes = b'0' * 1024
    files = {'file': ('test.mp4', video_bytes, 'video/mp4')}
    r = client.post(
        '/videos/upload',
        headers={'Authorization': f'Bearer {token}'},
        files=files,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data['added_score'] > 0
    assert data['bonus_applied'] is True
