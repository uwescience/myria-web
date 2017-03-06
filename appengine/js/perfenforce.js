function loadEditor(relationCounter) {
    var elements = document.getElementsByName('relationSchema');
    var schemaEditor = CodeMirror.fromTextArea(elements[relationCounter], {
        indentUnit: 2,
        theme: 'github',
        autofocus: true,
        matchBrackets: true,
        lineNumbers: true,
        lineWrapping: true,
        viewportMargin: Infinity,
        showTrailingSpace: true
    });
    schemaEditor.setOption('mode', {
        name: 'myrial',
        singleLineStringErrors: false
    });
    schemaEditors.push(schemaEditor)
}

function addDimension() {
    dimID++;
    var div = document.createElement('div');
    div.innerHTML = '<div class="panel panel-success" id="' + "dim" + dimID + '">\
	<div class="panel-heading">Dimension Table</div>\
	<div class="panel-body">\
	  <label>Relation Name</label>\
      <input type="text" class="form-control" value="part" name="relationName">\
      <br>\
	  <label>S3 Bucket/Key</label>\
	  <input type="text" class="form-control" name="relationS3Bucket" value="s3://tpchssb/partOUT.csv">\
	  <br>\
	  <label>MyriaL Load Statement</label>\
	  <textarea cols="83" rows="2" class="form-control" name="relationSchema">schema(p_partkey:int, p_name:string, p_mfgr:string,p_category:string, p_brand:string, p_color:string, p_type:string, p_size:int, p_container:string)</textarea>\
	  <br>\
      <label> Delimiter </label>\
      <input type="text" class="form-control" value="|" name="relationDelimiter">\
      <br>\
	  <label>Primary Key Index <span class="glyphicon glyphicon-info-sign" data-toggle="tooltip" title="List the index of the primary key" id="dimPkTooltip"></label>\
      <input type="text" class="form-control" value="0" name="relationPrimaryKey">\
      <br>\
	  <label >Foreign Key Index for Fact Table <span class="glyphicon glyphicon-info-sign" data-toggle="tooltip" title="List the index of the foreign key (with respect to the Fact table)" id="dimFkTooltip"></label>\
      <input type="text" class="form-control" value="3" name="relationForeignKey">\
	</div>\
	</div>';

    document.getElementById('additionalDimensionTables').appendChild(div);

    $("#dimFkTooltip").tooltip();
    $("#dimPkTooltip").tooltip();
    loadEditor(dimID);
}

function removeDimension() {
    var elem = document.getElementById("dim" + dimID);
    elem.remove();
    dimID--;
}

function generatePSLA() {
    var relationNames = document.getElementsByName("relationName");
    var relationS3Buckets = document.getElementsByName("relationS3Bucket");
    var relationSchemas = document.getElementsByName("relationSchema");
    var relationDelimiters = document.getElementsByName("relationDelimiter");
    var relationPrimaryKeys = document.getElementsByName("relationPrimaryKey");
    var relationForeignKeys = document.getElementsByName("relationForeignKey");

    tablesList = []
    for (i = 0; i < dimID + 1; i++) {
        tableDesc = {}
        relationKey = {}
        relationKey.userName = "public"
        relationKey.programName = "adhoc"
        relationKey.relationName = relationNames[i].value
        tableDesc.relationKey = relationKey

        type = (0 == i ? "fact" : "dimension")
        tableDesc.type = type

        source = {}
        source.dataType = "S3"
        source.s3Uri = relationS3Buckets[i].value
        tableDesc.source = source

        loadStatement = schemaEditors[i].getValue()
        firstParen = loadStatement.indexOf("(")
        secondParen = loadStatement.indexOf(")")
        schemaList = loadStatement.substring(firstParen + 1, secondParen).split(',')

        columnTypes = []
        columnNames = []
        for (s = 0; s < schemaList.length; s++) {
            currentColumnName = schemaList[s].split(':')[0].trim()
            currentColumnType = schemaList[s].split(':')[1].trim()
            switch (currentColumnType) {
                case "int":
                    currentColumnTypeMyria = "LONG_TYPE"
                    break;
                case "string":
                    currentColumnTypeMyria = "STRING_TYPE"
                    break;
                case "float":
                    currentColumnTypeMyria = "FLOAT_TYPE"
                    break;
            }
            columnTypes.push(currentColumnTypeMyria)
            columnNames.push(currentColumnName)
        }
        schema = {}
        schema.columnTypes = columnTypes
        schema.columnNames = columnNames
        tableDesc.schema = schema

        if (type == "fact") {
            factTable = tableDesc.relationKey.relationName
            factName = 'public:adhoc:' + factTable
            editorText = 'SELECT ' + columnNames[0] + '\n' + 'FROM "' + factName + '"'
            editor.getDoc().setValue(editorText);
        }

        tableDesc.delimiter = relationDelimiters[i].value

        keys = []
        splitKeys = relationPrimaryKeys[i].value.split(',')
        for (k = 0; k < splitKeys.length; k++) {
            keys.push(Number(splitKeys[k]))
        }
        tableDesc.keys = keys

        foreign_keys = []
        if (i != 0) {
            foreign_keys.push(Number(relationForeignKeys[i].value))
            tableDesc.corresponding_fact_key = foreign_keys
        }
        tablesList.push(tableDesc)
    }

    $.ajax({
        type: 'POST',
        url: myria_connection + "/perfenforce/preparePSLA",
        dataType: 'json',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        data: JSON.stringify(tablesList),
        global: false,
        async: true,
        success: function(data) {
            return data;
        }
    });


    $('#startPSLA').button('loading');
    var interval = setInterval(function() {
        $.when(getRequest('/perfenforce/isDonePSLA')).done(function(data) {
            if (data == true) {
                $('#startPSLA').button('reset');
                document.getElementById('startPSLA').disabled = true;
                document.getElementById('angular-section').style.visibility = 'visible'
                scrollTo("PSLA");
                loadQueries()
                prepareDynamicTiers()
                clearInterval(interval);
            }
            $.when(getRequest('/perfenforce/getDataPreparationStatus')).done(function(data) {
                document.getElementById('PSLAStatus').innerHTML = 'Status: ' + data
            });
        })
    }, 10000);
}

function scrollTo(hash) {
    location.hash = "#" + hash;
}


function getRequest(command) {
    return $.ajax({
        type: 'GET',
        url: myria_connection + command,
        global: false,
        datatype: 'json',
        async: false,
        success: function(data) {
            return data;
        }
    });
}

function loadQueries() {
    $.when(getRequest('/perfenforce/getPSLA')).done(function(data) {
        data = JSON.parse(data)
        allQueries = data.queries;
    });
};

function prepareDynamicTiers() {
    var dynamicTiers = angular.module('tiers', []);

    // Switching out symbols to prevent conflict with Jinja
    dynamicTiers.config(function($interpolateProvider) {
        $interpolateProvider.startSymbol('{[{').endSymbol('}]}');
    });

    dynamicTiers.filter('keys', function() {
        return function(input) {
            if (!input) {
                return [];
            }
            return Object.keys(input);
        }
    });

    dynamicTiers.value('allQueries', allQueries);
    dynamicTiers.controller('WizardController', [
        '$http',
        'filterFilter',
        'orderByFilter',
        'allQueries',
        function(http, filter, orderBy, allQueries) {
            this.tiers = [{
                "id": 1,
                "name": "1",
                "cost": "0.52"
            }, {
                "id": 2,
                "name": "2",
                "cost": "0.78"
            }, {
                "id": 3,
                "name": "3",
                "cost": "1.04"
            }]
            this.allQueries = allQueries;

            this.setTier = function(tier) {
                $.ajax({
                    type: 'POST',
                    url: myria_connection + "/perfenforce/setTier",
                    data: tier,
                    contentType: 'text/plain',
                    global: false,
                    async: false,
                    processData: false,
                    success: function(data) {
                        return data;
                    }
                });
                document.getElementsByClassName('tierButton').disabled = true;
                document.getElementById('angular-section').style.visibility = 'hidden'
                document.getElementById('query-section').style.visibility = 'visible'
                scrollTo("query");
            };

            this.getQueriesForTier = function(tier) {
                if (!this.allQueries)
                    return;

                var filteredQueries = filter(this.allQueries, {
                    tier: tier
                });

                var orderedQueries = orderBy(filteredQueries, function(query) {
                    return query.runtime;
                });

                var groupedQueries = {};
                for (var query in orderedQueries) {
                    var group = 'g' + orderedQueries[query].runtime;

                    if (groupedQueries[group] == null)
                        groupedQueries[group] = [];

                    groupedQueries[group].push(orderedQueries[query]);
                    groupedQueries[group].runtime = orderedQueries[query].runtime;
                }

                return groupedQueries;
            };
        }
    ]);

    // Enable angular application
    var section = document.getElementById('angular-section');
    angular.bootstrap(section, ['tiers']);
}


function getQuerySLA() {
    document.getElementById('executeButton').disabled = true;
    document.getElementById('slaButton').disabled = true;

    document.getElementById('slaInfo').innerHTML = ""
    document.getElementById('clusterInfo').innerHTML = ""
    document.getElementById('runningInfo').innerHTML = ""

    document.getElementById('PSLAStatus').innerHTML = ""

    querySQL = editor.getValue();
    $.ajax({
        type: 'POST',
        url: myria_connection + "/perfenforce/findSLA",
        data: querySQL,
        contentType: 'text/plain',
        global: false,
        async: true,
        processData: false,
        success: function(data) {
            $.when(getRequest('/perfenforce/getCurrentQuery')).done(function(currentQuery) {
                document.getElementById("slaInfo").innerHTML = "SLA for query: " + currentQuery.slaRuntime + " seconds";
                currentSLA = currentQuery.slaRuntime;
                document.getElementById('executeButton').disabled = false;
                document.getElementById('slaButton').disabled = false;
            });
        }
    });

}

function runQuery() {
    $.when(getRequest('/perfenforce/getClusterSize')).done(function(clusterSize) {
        document.getElementById('clusterInfo').innerHTML = 'Myria is using <font color="blue">' + clusterSize + '</font> workers'
        currentClusterSize = clusterSize
        executePlan()
    });
    document.getElementById('executeButton').disabled = true;
}

function executePlan() {
    var clusterSize = 0
    var workerArray = [];
    $.when(getRequest('/perfenforce/getClusterSize')).done(function(clusterSize) {
        for (i = 1; i <= clusterSize; i++) {
            workerArray.push(i)
        }
        currentQueryText = editor.getValue();
        querySQL = editor.getValue();
        querySQL = querySQL.replace(factTable, factTable + clusterSize)
        json_plan = {}
        json_plan.rawQuery = querySQL
        json_plan.logicalRa = ""
        json_plan.plan = {}
        json_plan.plan.type = "SubQuery"
        json_plan.plan.fragments = []
        fragmentsObj = {}
        fragmentsObj.overrideWorkers = workerArray
        fragmentsObj.operators = []
        dbQueryScan = {}
        relationKey = {}
        relationKey.relationName = factTable + clusterSize
        relationKey.programName = "adhoc"
        relationKey.userName = "public"
        dbQueryScan.sourceRelationKeys = [relationKey]
        dbQueryScan.opType = "DbQueryScan"
        dbQueryScan.opId = 0
        dbQueryScan.opName = "scan"
        dbQueryScan.schema = {}
        dbQueryScan.schema.columnTypes = []
        dbQueryScan.schema.columnNames = []
        dbQueryScan.sql = querySQL
        sinkRoot = {}
        sinkRoot.opType = "EmptySink"
        sinkRoot.opId = 1
        sinkRoot.opName = "MyriaSink"
        sinkRoot.argChild = 0
        fragmentsObj.operators.push(dbQueryScan)
        fragmentsObj.operators.push(sinkRoot)
        json_plan.plan.fragments.push(fragmentsObj)

        var request = $.post("/executejson", {
            jsonQuery: JSON.stringify(json_plan)
        }).success(function(newStatus) {
            documentQueryStatus(newStatus);
        });
    });
}

documentQueryStatus = function(result) {
    var start_time = result['startTime'];
    var end_time = result['finishTime'];
    var elapsed = result['elapsedNanos'] / 1e9;
    var status = result['status'];
    var query_id = result['queryId'];

    document.getElementById('runningInfo').innerHTML = ("Query Status: " + status + " <br> Seconds Elapsed: " + (elapsed));

    if (status === 'ACCEPTED' || status === 'RUNNING' || status === 'PAUSED') {
        setTimeout(function() {
            $.get("/executejson", {
                queryId: query_id
            }).success(function(newStatus) {
                documentQueryStatus(newStatus);
            })
        }, 1000);
    } else if (status == "SUCCESS") {
        var request = new FormData();
        request.append('dataPointRuntime', elapsed);
        $.ajax({
            type: 'POST',
            url: myria_connection + "/perfenforce/recordRealRuntime",
            data: request,
            contentType: false,
            global: false,
            async: false,
            processData: false,
            success: function(data) {
                return data;
            }
        });
        addRuntimeToList(currentQueryText, elapsed, currentSLA, currentClusterSize)
    }
};

function addRuntimeToList(queryText, runtime, sla, clusterSize) {
    if (runtime > sla) {
        $("#previousQueryList ul").prepend(
            '<li><p>Query: ' + queryText + '<br>Actual Runtime: <font color="red">' + runtime + '</font>' + '<br>Expected Runtime: ' + sla + '<br>Cluster Size Ran: ' + clusterSize + '</p></li>');
    } else {
        $("#previousQueryList ul").prepend(
            '<li><p>Query: ' + queryText + '<br>Actual Runtime: <font color="green">' + runtime + '</font>' + '<br>Expected Runtime: ' + sla + '<br>Cluster Size Ran: ' + clusterSize + '</p></li>');
    }
}

function checkQueryStatus(query_id) {
    var errFunc = function(error) {
        displayQueryError(error, query_id);
    };
    $.ajax("/execute", {
        type: 'GET',
        data: {
            queryId: query_id,
            language: editorLanguage
        },
        success: displayQueryStatus,
        error: errFunc
    });
}

function displayQueryError(error, query_id) {
    var pre = document.createElement('pre');
    multiline($('#runningInfo').empty().append(pre),
        "Error checking query status; it's probably done. Attempting to refresh\n" + error.responseText);
    setTimeout(function() {
        checkQueryStatus(query_id);
    }, 1000);
}

function displayQueryStatus(query_status) {
    var t = editor_templates.query;
    var query_id = query_status['queryId'];
    var status = query_status['status'];
    var html = '';

    html += t.row({
        name: 'Query Status',
        val: status
    });
    html += t.time_row({
        name: 'Start',
        val: query_status['startTime']
    });
    html += t.time_row({
        name: 'End',
        val: query_status['finishTime']
    });
    html += t.row({
        name: 'Elapsed',
        val: query_status['elapsedNanos'] / 1000000000
    });
    html = t.table({
        myriaConnection: myriaConnection,
        query_id: query_id,
        content: html
    });

    if (status === 'SUCCESS' && query_status['profilingMode'].indexOf('QUERY') > -1) {
        html += t.prof_link({
            query_id: query_id
        });
    } else if (status === 'ERROR') {
        html += t.err_msg({
            message: query_status['message'] || '(missing)'
        });
    }
    $("#runningInfo").html(html);

    if (status === 'ACCEPTED' || status === 'RUNNING' || status === 'PAUSED' || status === 'KILLING') {
        setTimeout(function() {
            checkQueryStatus(query_id);
        }, 1000);
    }
}

function restart() {
    document.getElementById('angular-section').style.visibility = 'hidden'
    document.getElementById('startPSLA').disabled = false;
    document.getElementById('query-section').style.visibility = 'hidden'
    document.getElementsByClassName('tierButton').disabled = false;
    document.getElementById('slaInfo').innerHTML = ""
    document.getElementById('clusterInfo').innerHTML = ""
    document.getElementById('runningInfo').innerHTML = ""
    $("#previousQueryList ul").empty();
    scrollTo("inputSchema")
}

/* Based on: http://stackoverflow.com/a/6455874/1715495 */
function multiline(elt, text) {
    var htmls = [];
    var lines = text.split(/\n/);

    var tmpDiv = jQuery(document.createElement('div'));
    for (var i = 0; i < lines.length; i++) {
        htmls.push(tmpDiv.text(lines[i]).html());
    }
    elt.html(htmls.join("<br>"));
}

//To initialize
$(document).ready(function() {
    $("#pkTooltip").tooltip();
});
var schemaEditors = []
loadEditor(0);

var dimID = 0
var allQueries = null
var factTable = null

var currentQueryText = null;
var currentSLA = 0;
var currentClusterSize = 0;
