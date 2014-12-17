from json import dumps as jstr
import sys
import urlparse

from httmock import all_requests, HTTMock
from nose.tools import assert_equals
from webtest import TestApp

from myria_web_main import Application


app = TestApp(Application(hostname='fake.fake', port=12345))


def mock_myria_get(url, request):
    query_params = urlparse.parse_qs(url.query)

    # The below JSON responses are taken directly from production Myria instance
    # with vega.cs.washington.edu:1776 changed to fakefake:12345
    queries = [{"url":"http://fake.fake:12345/query/query-140", "queryId":140, "rawQuery":"JustX(x) :- TwitterK(x,y)", "logicalRa":None, "physicalPlan":None, "submitTime":"2014-02-26T15:10:37.718-08:00", "startTime":"2014-02-26T15:10:37.878-08:00", "finishTime":"2014-02-26T15:10:38.648-08:00", "message":None, "elapsedNanos":769418780, "status":"SUCCESS"}, {"url":"http://fake.fake:12345/query/query-139", "queryId":139, "rawQuery":"download [public#adhoc#TwitterK]", "logicalRa":None, "physicalPlan":None, "submitTime":"2014-02-26T00:51:54.868-08:00", "startTime":"2014-02-26T00:51:54.963-08:00", "finishTime":"2014-02-26T00:51:55.002-08:00", "message":None, "elapsedNanos":38598641, "status":"SUCCESS"}, {"url":"http://fake.fake:12345/query/query-138", "queryId":138, "rawQuery":"download [public#adhoc#Twitter]", "logicalRa":None, "physicalPlan":None, "submitTime":"2014-02-26T00:36:54.845-08:00", "startTime":"2014-02-26T00:36:54.970-08:00", "finishTime":"2014-02-26T00:36:55.222-08:00", "message":None, "elapsedNanos":252420874, "status":"KILLED"}, {"url":"http://fake.fake:12345/query/query-137", "queryId":137, "rawQuery":"download [public#adhoc#TwitterK]", "logicalRa":None, "physicalPlan":None, "submitTime":"2014-02-26T00:10:06.066-08:00", "startTime":"2014-02-26T00:10:06.173-08:00", "finishTime":"2014-02-26T00:10:06.926-08:00", "message":None, "elapsedNanos":752888288, "status":"SUCCESS"}, {"url":"http://fake.fake:12345/query/query-136", "queryId":136, "rawQuery":"download [public#adhoc#TwitterK]", "logicalRa":None, "physicalPlan":None, "submitTime":"2014-02-25T23:59:33.023-08:00", "startTime":"2014-02-25T23:59:33.181-08:00", "finishTime":"2014-02-25T23:59:33.337-08:00", "message":None, "elapsedNanos":155921007, "status":"KILLED"}, {"url":"http://fake.fake:12345/query/query-135", "queryId":135, "rawQuery":"download [public#__TEMP__#JustX]", "logicalRa":None, "physicalPlan":None, "submitTime":"2014-02-25T23:55:20.921-08:00", "startTime":"2014-02-25T23:55:21.126-08:00", "finishTime":"2014-02-25T23:55:21.396-08:00", "message":None, "elapsedNanos":270059319, "status":"KILLED"}, {"url":"http://fake.fake:12345/query/query-134", "queryId":134, "rawQuery":"JustX(x) :- TwitterK(x,y)", "logicalRa":None, "physicalPlan":None, "submitTime":"2014-02-25T23:07:21.028-08:00", "startTime":"2014-02-25T23:07:21.469-08:00", "finishTime":"2014-02-25T23:07:22.765-08:00", "message":None, "elapsedNanos":1295696742, "status":"SUCCESS"}, {"url":"http://fake.fake:12345/query/query-133", "queryId":133, "rawQuery":"JustX(x) :- TwitterK(x,y)", "logicalRa":None, "physicalPlan":None, "submitTime":"2014-02-25T18:01:57.636-08:00", "startTime":None, "finishTime":None, "message":None, "elapsedNanos":None, "status":"UNKNOWN"}, {"url":"http://fake.fake:12345/query/query-132", "queryId":132, "rawQuery":"all_opp_vct =\nSELECT Opp.*, Vct.pop, Vct.support\nFROM SCAN(armbrustlab:seaflow:all_opp_v3) AS Opp,\n     SCAN(armbrustlab:seaflow:all_vct) AS Vct\nWHERE (Opp.Cruise = Vct.Cruise)\n  AND (Opp.Day = Vct.Day)\n  AND (Opp.File_Id = Vct.File_Id)\n  AND (Opp.Cell_Id = Vct.Cell_Id);", "logicalRa":None, "physicalPlan":None, "submitTime":"2014-02-25T17:05:18.617-08:00", "startTime":None, "finishTime":None, "message":None, "elapsedNanos":None, "status":"UNKNOWN"}, {"url":"http://fake.fake:12345/query/query-131", "queryId":131, "rawQuery":"T1 = SCAN(TwitterK);\n\nT2 = [FROM T1 EMIT $0 AS x];\n\nSTORE (T2, JustX);", "logicalRa":None, "physicalPlan":None, "submitTime":"2014-02-25T15:28:47.782-08:00", "startTime":"2014-02-25T15:28:48.668-08:00", "finishTime":"2014-02-25T15:28:50.177-08:00", "message":None, "elapsedNanos":1509299867, "status":"SUCCESS"}]
    twitter_dataset = {"relationKey":{"userName":"public", "programName":"adhoc", "relationName":"Twitter"}, "schema":{"columnTypes":["INT_TYPE", "INT_TYPE"], "columnNames":["followee", "follower"]}, "numTuples":1427579976, "queryId":2, "created":"2014-02-09T12:40:43.438-08:00", "uri":"http://fake.fake:12345/dataset/user-public/program-adhoc/relation-Twitter"}
    twitterk_dataset = {"relationKey":{"userName":"public", "programName":"adhoc", "relationName":"TwitterK"}, "schema":{"columnTypes":["INT_TYPE", "INT_TYPE"], "columnNames":["followee", "follower"]}, "numTuples":2715, "queryId":3, "created":"2014-02-09T12:40:43.438-08:00", "uri":"http://fake.fake:12345/dataset/user-public/program-adhoc/relation-TwitterK"}

    if url.path == '/workers':
        return jstr({'1': 'localhost:12347', '2': 'localhost:12348'})
    elif url.path == '/workers/alive':
        return jstr([1, 2])
    elif url.path == '/dataset':
        return jstr([twitter_dataset, twitterk_dataset])
    elif url.path == '/dataset/user-public/program-adhoc/relation-Twitter':
        return jstr(twitter_dataset)
    elif url.path == '/dataset/user-public/program-adhoc/relation-TwitterK':
        return jstr(twitterk_dataset)
    elif url.path == '/query':
        limit = int((query_params.get('limit') or [10])[0])
        ret = queries[:limit]
        body = {'max': ret[0]['queryId'], 'min': ret[-1]['queryId'],
                'results': ret}
        return {'status_code': 200, 'content': body}
    elif url.path == '/query/query-140':
        return {'status_code': 201,
                'headers': {'Location': 'http://fake.fake:12345/query/query-140'},
                'content': queries[0]}
    print >> sys.stderr, "Did not handle URL {}".format(url)


def mock_myria_post(url, request):
    if url.path == '/query':
        return {'status_code': 201,
                'headers': {'Location': 'http://fake.fake:12345/query/query-140'}}

    print >> sys.stderr, "Did not handle URL {}".format(url)


@all_requests
def mock_myria(url, request):
    assert url.netloc == 'fake.fake:12345'

    if request.method == 'GET':
        return mock_myria_get(url, request)
    elif request.method == 'POST':
        return mock_myria_post(url, request)

    print >> sys.stderr, "Did not handle URL {}".format(url)


def mock_get(url, params=None):
    with HTTMock(mock_myria):
        return app.get(url, params)


def mock_post(url, params=None):
    with HTTMock(mock_myria):
        return app.post(url, params)


def test_redirect():
    response = mock_get('/')
    assert_equals(response.status_code, 301)
    assert response.headers['Location']
    assert response.headers['Location'].endswith('/editor')


def test_editor_connects():
    response = mock_get('/editor')
    assert_equals(response.status_code, 200)
    assert 'fake.fake:12345 [2/2]' in str(response)


def test_queries_connects():
    response = mock_get('/queries')
    assert_equals(response.status_code, 200)
    assert 'fake.fake:12345 [2/2]' in str(response)
    # Check some subset of things are in the right place
    assert 'JustX(x) :- TwitterK(x,y)' in str(response)
    assert 'query-140' in str(response)
    assert 'query-131' in str(response)


def test_datasets_connects():
    response = mock_get('/datasets')
    assert_equals(response.status_code, 200)
    assert 'fake.fake:12345 [2/2]' in str(response)
    # Ensure it includes the Twitter dataset, creation time, and download URL
    assert 'Twitter' in str(response)
    assert '2014-02-09T12:40:43.438-08:00' in str(response)
    assert 'fake.fake:12345/dataset/user-public/program-adhoc/relation-Twitter/data' not in str(response)
    assert 'fake.fake:12345/dataset/user-public/program-adhoc/relation-TwitterK/data' in str(response)


def test_datalog():
    params = {'language': 'datalog',
              'query': 'A(x) :- Twitter(x,3)'}
    response = mock_get('/plan', params)
    assert_equals(response.status_code, 200)
    assert 'Apply' in str(response)

    response = mock_get('/optimize', params)
    assert_equals(response.status_code, 200)
    assert 'MyriaApply' in str(response)

    # Note that Datalog compile exercises the Catalog
    response = mock_get('/compile', params)
    assert_equals(response.status_code, 200)
    assert response.json
    assert_equals(params['query'], response.json['rawQuery'])
    assert_equals(params['language'], response.json['language'])

    response = mock_post('/execute', params)
    assert_equals(response.status_code, 201)


def test_myrial():
    params = {'language': 'myrial',
              'query': '''R = SCAN(public:adhoc:Twitter);
                          Ans = [FROM R WHERE $1=3 EMIT $0];
                          STORE(Ans, justx);'''}
    response = mock_get('/plan', params)
    assert_equals(response.status_code, 200)
    assert 'Apply' in str(response)

    response = mock_get('/optimize', params)
    assert_equals(response.status_code, 200)
    assert 'MyriaApply' in str(response)

    response = mock_get('/compile', params)
    assert_equals(response.status_code, 200)
    assert response.json
    assert_equals(params['query'], response.json['rawQuery'])
    assert_equals(params['language'], response.json['language'])

    response = mock_post('/execute', params)
    assert_equals(response.status_code, 201)


def test_sql():
    params = {'language': 'sql',
              'query': '''R = SCAN(public:adhoc:Twitter);
                          Ans = SELECT $0 FROM R WHERE $1=3;
                          STORE(Ans, justx);'''}
    response = mock_get('/plan', params)
    assert_equals(response.status_code, 200)
    assert 'Apply' in str(response)

    response = mock_get('/optimize', params)
    assert_equals(response.status_code, 200)
    assert 'MyriaApply' in str(response)

    response = mock_get('/compile', params)
    assert_equals(response.status_code, 200)
    assert response.json
    assert_equals(params['query'], response.json['rawQuery'])
    assert_equals(params['language'], response.json['language'])

    response = mock_post('/execute', params)
    assert_equals(response.status_code, 201)


# TODO - delete this? It doesn't actually use the network
def test_dot_datalog():
    # Datalog logical
    params = {'language': 'datalog',
              'type': 'logical',
              'query': 'A(x) :- R(x,3)'}
    response = mock_get('/dot', params)
    assert_equals(response.status_code, 200)
    # .. physical
    params['type'] = 'physical'
    response = mock_get('/dot', params)
    assert_equals(response.status_code, 200)


def test_dot_myrial():
    # Myrial logical
    params = {'language': 'myrial',
              'type': 'logical',
              'query': '''R = SCAN(public:adhoc:Twitter);
                          Ans = [FROM R WHERE $1=3 EMIT $0];
                          STORE(Ans, justx);'''}
    response = mock_get('/dot', params)
    assert_equals(response.status_code, 200)
    # .. physical
    params['type'] = 'physical'
    response = mock_get('/dot', params)
    assert_equals(response.status_code, 200)


def test_dot_sql():
    # SQL logical
    params = {'language': 'sql',
              'type': 'logical',
              'query': '''R = SCAN(public:adhoc:Twitter);
                          Ans = SELECT $0 FROM R WHERE $1=3;
                          STORE(Ans, justx);'''}
    response = mock_get('/dot', params)
    assert_equals(response.status_code, 200)
    # .. physical
    params['type'] = 'physical'
    response = mock_get('/dot', params)
    assert_equals(response.status_code, 200)
