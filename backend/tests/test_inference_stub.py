def test_inference_disabled(client):
    r = client.post('/inference/frame', files={'file': ('f.jpg', b'123', 'image/jpeg')}, data={'focal_length': '800'})
    assert r.status_code == 503

# NOTE: enabling inference after app created won't trigger model load in this simple test scaffold.
