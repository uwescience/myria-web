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


def test_datalog_logical():
    params = {'language': 'datalog',
              'query': 'A(x) :- R(x,3)'}
    response = app.get('/plan', params)
    assert response.status_code == 200
    assert 'Project' in str(response)

    response = app.get('/optimize', params)
    assert response.status_code == 200
    assert 'MyriaApply' in str(response)

    # Cannot test Datalog physical without live server--Catalog required


def test_myrial():
    params = {'language': 'myrial',
              'query': '''R = Empty(x:int, y:int);
                          Ans = [FROM R WHERE y=3 EMIT x ];
                          STORE(Ans, justx);'''}
    response = app.get('/plan', params)
    assert response.status_code == 200
    assert 'Apply' in str(response)

    response = app.get('/optimize', params)
    assert response.status_code == 200
    assert 'MyriaApply' in str(response)

    response = app.get('/compile', params)
    assert response.status_code == 200
    assert response.json
    assert response.json['rawDatalog'] == params['query']


def test_sql():
    params = {'language': 'sql',
              'query': '''R = Empty(x:int, y:int);
                          Ans = SELECT x FROM R WHERE y=3;
                          STORE(Ans, justx);'''}
    response = app.get('/plan', params)
    assert response.status_code == 200
    assert 'Apply' in str(response)

    response = app.get('/optimize', params)
    assert response.status_code == 200
    assert 'MyriaApply' in str(response)

    response = app.get('/compile', params)
    assert response.status_code == 200
    assert response.json
    assert response.json['rawDatalog'] == params['query']


def test_dot_datalog():
    # Datalog logical
    params = {'language': 'datalog',
              'type': 'logical',
              'query': 'A(x) :- R(x,3)'}
    response = app.get('/dot', params)
    assert response.status_code == 200
    # .. physical
    params['type'] = 'physical'
    response = app.get('/dot', params)
    assert response.status_code == 200

def test_dot_myrial():
    # Myrial logical
    params = {'language': 'myrial',
              'type': 'logical',
              'query': '''R = Empty(x:int, y:int);
                          Ans = [FROM R WHERE y=3 EMIT x];
                          STORE(Ans, justx);'''}
    response = app.get('/dot', params)
    assert response.status_code == 200
    # .. physical
    params['type'] = 'physical'
    response = app.get('/dot', params)
    assert response.status_code == 200

def test_dot_sql():
    # SQL logical
    params = {'language': 'sql',
              'type': 'logical',
              'query': '''R = Empty(x:int, y:int);
                          Ans = SELECT x FROM R WHERE y=3;
                          STORE(Ans, justx);'''}
    response = app.get('/dot', params)
    assert response.status_code == 200
    # .. physical
    params['type'] = 'physical'
    response = app.get('/dot', params)
    assert response.status_code == 200
