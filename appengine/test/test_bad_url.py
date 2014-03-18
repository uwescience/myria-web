from myria_web_main import Application
from webtest import TestApp

app = TestApp(Application(hostname='fake.fake', port=12345))

def test_redirect():
    response = app.get('/')
    assert response.status_code == 301
    assert response.headers['Location']
    assert response.headers['Location'].endswith('/editor')

def test_editor_loads():
    response = app.get('/editor')
    assert response.status_code == 200
    assert 'error connecting to fake.fake:12345' in str(response)

def test_queries_loads():
    response = app.get('/queries')
    assert response.status_code == 200
    assert 'error connecting to fake.fake:12345' in str(response)


def test_datasets_loads():
    response = app.get('/datasets')
    assert response.status_code == 200
    assert 'error connecting to fake.fake:12345' in str(response)
