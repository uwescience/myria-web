function loadEditor(relationCounter) {
    var elements = document.getElementsByName('relationSchema');
    var editor = CodeMirror.fromTextArea(elements[relationCounter], {
        indentUnit: 2,
        theme: 'github',
        autofocus: true,
        matchBrackets: true,
        lineNumbers: true,
        lineWrapping: true,
        viewportMargin: Infinity,
        showTrailingSpace: true
    });
    editor.setOption('mode', { name: 'myrial', singleLineStringErrors: false });
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
      <input type="text" class="form-control" value="," name="relationDelimiter">\
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
    // First, we collect the form data
    var relationNames = document.getElementsByName("relationName");
    var relationS3Buckets = document.getElementsByName("relationS3Bucket");
    var relationSchemas = document.getElementsByName("relationSchema");
    var relationDelimiters = document.getElementsByName("relationDelimiter");
    var relationPrimaryKeys = document.getElementsByName("relationPrimaryKey");
    var relationForeignKeys = document.getElementsByName("relationForeignKey");

    // Iterate through the tables (+1 for fact)
    // This loop extracts data from the forms and sends JSON to myria
    tablesList = []
    for (i = 0; i < dimID + 1; i++) {
        console.log(i)
        tableDesc = {}
        relationKey = {}
        relationKey.userName = "public"
        relationKey.programName = "adhoc"
        relationKey.relationName = relationNames[i].value
        tableDesc.relationKey = relationKey

        type = i == 0 ? "fact" : "dimension"
        tableDesc.type = type

        if (type == "fact") {
            factTable = tableDesc.relationKey.relationName
        }

        source = {}
        source.dataType = "S3"
        source.s3Uri = relationS3Buckets[i].value
        tableDesc.source = source

        loadStatement = relationSchemas[i].value
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
    console.log(JSON.stringify(tablesList))

    $.ajax({
        type: 'POST',
        url: myria_connection + "/perfenforce/preparePSLA",
        dataType: 'json',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        data: JSON.stringify(tablesList),
        global: false,
        async: true,
        success: function (data) {
            return data;
        }
    });

    $('#startPSLA').button('loading');

    while (getRequest('isDonePSLA') == 'false') {
        setTimeout(function () {
            console.log("not finished")
        }, 10000);
    }

    // this is where we want to load queries
    loadQueries()
    prepareDynamicTiers()
    scrollTo("PSLA");
}

function scrollTo(hash) {
    location.hash = "#" + hash;
}

function getRequest(command) {
    return $.ajax({
        type: 'GET',
        url: myria_connection + "/" + command,
        dataType: 'json',
        global: false,
        async: false,
        success: function (data) {
            return data;
        }
    });
}

function loadQueries() {
    console.log("load queries")

    $.when(getRequest('/perfenforce/getCurrentQuery')).done(function (currentQuery) {
                    console.log(currentQuery)
                    document.getElementById("slaInfo").innerHTML = "Expected Runtime (from SLA): " + currentQuery.slaRuntime + " seconds";
                    currentSLA = currentQuery.slaRuntime;
                });

    allQueries = result.queries;
};

/* in progress */
function prepareDynamicTiers() {
    var dynamicTiers = angular.module('tiers', []);

    // Switching out symbols to prevent conflict with Jinja
    dynamicTiers.config(function ($interpolateProvider) {
        $interpolateProvider.startSymbol('{[{').endSymbol('}]}');
    });

    dynamicTiers.filter('keys', function () {
        return function (input) {
            if (!input) {
                return [];
            }
            return Object.keys(input);
        }
    });

    dynamicTiers.value('allQueries', allQueries);


    dynamicTiers.controller('WizardController', [
        '$scope',
        '$http',
        'filterFilter',
        'orderByFilter',
        'allQueries',
        function ($scope, http, filter, orderBy, allQueries) {
            this.tiers = [{ "id": 1, "name": "1", "cost": "0.16" },
            { "id": 2, "name": "2", "cost": "0.16" },
            { "id": 3, "name": "3", "cost": "0.16" }]


            this.tier = 0;
            this.allQueries = allQueries;
            this.queryCache = [];
            this.executionLog = '';

            this.setTier = function (tier) {
                console.log("setting tier to" + tier)
                this.tier = tier;
                localStorage.setItem("tier", tier - 1);
                selectTier(tier);
                scrollTo("query-session");
            };

            this.getTierWizard = function (tier) {
                currentTier = localStorage.getItem("tier");
                return this.tiers[currentTier]
            };

            this.getQueriesForTier = function (tier) {
                //console.log(allQueries)
                if (!this.allQueries)
                    return;

                if (this.queryCache[tier])
                    return this.queryCache[tier];

                var filteredQueries = filter(this.allQueries, {
                    tier: tier
                });
                console.log(filteredQueries)

                var orderedQueries = orderBy(filteredQueries, function (query) {
                    return query.runtime;
                });
                console.log(orderedQueries)

                var groupedQueries = {};
                for (var query in orderedQueries) {
                    var group = 'g' + orderedQueries[query].runtime;

                    if (groupedQueries[group] == null)
                        groupedQueries[group] = [];

                    groupedQueries[group].push(orderedQueries[query]);
                    groupedQueries[group].runtime = orderedQueries[query].runtime;
                }

                this.queryCache[tier] = groupedQueries;
                return groupedQueries;
            };

            this.log = function (text) {
                this.executionLog = text + '\n';
            };
        }]);

    // Enable angular app
    var section = document.getElementById('angular-section');
    angular.bootstrap(section, ['tiers']);
}

function selectTier(tier) {

var request = new FormData();
        request.append('tier', tier);

    $.ajax({
        type: 'POST',
        url: myria_connection + "/perfenforce/setTier",
        dataType: 'json',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        data: request,
        global: false,
        async: true,
        success: function (data) {
            return data;
        }
    });
}


function getQuerySLA() {
    var executeButton = document.getElementById('executeButton')
    if (executeButton !== null) {
        document.getElementById('slaInfo').innerHTML = ""
        document.getElementById('runningInfo').innerHTML = ""

        querySQL = editor.getValue();
        var request = new FormData();
        request.append('querySQL', querySQL);
        request.append('path', '/usr/local/myria/perfenforce_files/ScalingAlgorithms/');

        //send predict with query value
        $.ajax({
            type: 'POST',
            url: myria_connection + "/perfenforce/findSLA",
            data: request,
            contentType: false,
            global: false,
            async: false,
            processData: false,
            success: function (data) {
                //get the current query and update the label
                $.when(getRequest('/perfenforce/getCurrentQuery')).done(function (currentQuery) {
                    console.log(currentQuery)
                    document.getElementById("slaInfo").innerHTML = "Expected Runtime (from SLA): " + currentQuery.slaRuntime + " seconds";
                    currentSLA = currentQuery.slaRuntime;
                });
            }
        });

        document.getElementById('executeButton').disabled = false;
    }
}

function runQuery() {

    // intercept it here and recompile
    var executeButton = document.getElementById('executeButton')
    if (executeButton !== null) {

        $.when(getRequest('/perfenforce/getClusterSize')).done(function (clusterSize) {
            console.log("Cluster size " + clusterSize)
            console.log("Tier " + getTier())


            document.getElementById('picture').innerHTML = 'Cluster is using <font color="blue">' + clusterSize + '</font> workers'
            currentClusterSize = clusterSize
            executePlan()
        });

        document.getElementById('executeButton').disabled = true;

    }
}

function executePlan() {
    //need to create plan
    var clusterSize = 0
    var workerArray = [];
    $.when(getRequest('/perfenforce/getClusterSize')).done(function (clusterSize) {
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
        dbQueryScan.opType = "DbQueryScan"
        dbQueryScan.opId = 0
        dbQueryScan.opName = "scan"
        dbQueryScan.schema = {}
        dbQueryScan.schema.columnTypes = []
        dbQueryScan.schema.columnNames = []
        dbQueryScan.sql = querySQL
        sinkRoot = {}
        sinkRoot.opType = "SinkRoot"
        sinkRoot.opId = 1
        sinkRoot.opName = "MyriaSink"
        sinkRoot.argChild = 0
        fragmentsObj.operators.push(dbQueryScan)
        fragmentsObj.operators.push(sinkRoot)
        json_plan.plan.fragments.push(fragmentsObj)

        console.log(JSON.stringify(json_plan))

        var request = $.post("/executejson", {
            query: query,
            language: "MyriaL",
            jsonQuery: JSON.stringify(json_plan)
        }).success(function (newStatus) {
            documentQueryStatus(newStatus);
        });
    });
}


documentQueryStatus = function (result) {
    var start_time = result['startTime'];
    var end_time = result['finishTime'];
    var elapsed = result['elapsedNanos'] / 1e9;
    var status = result['status'];
    var query_id = result['queryId'];

    document.getElementById('runningInfo').innerHTML = (" status: " + status + " <br> seconds elapsed: " + (elapsed));

    if (status === 'ACCEPTED' || status === 'RUNNING' || status === 'PAUSED') {
        setTimeout(function () {
            $.get("/executejson", {
                queryId: query_id,
                language: 'MyriaL'
            }).success(function (newStatus) {
                documentQueryStatus(newStatus);
            })
        }, 1000);
    }
    else if (status == "SUCCESS") {
        var request = new FormData();
        request.append('dataPointRuntime', elapsed);
        // Make it block :( 
        $.ajax({
            type: 'POST',
            url: myria_connection + "/perfenforce/recordRealRuntime",
            data: request,
            contentType: false,
            global: false,
            async: false,
            processData: false,
            success: function (data) {
                return data;
            }
        });
        addRuntimeToList(currentQueryText, elapsed, currentSLA, currentClusterSize)
        document.getElementById('scalingInfo').style.visibility = 'visible'
        document.getElementById('previousLog').style.visibility = 'visible'
        document.getElementById('previousQueryList').style.visibility = 'visible'
    }
};

function addRuntimeToList(queryDesc, runtime, sla, clusterSize) {
    if (runtime > sla) {
        $("#previousQueryList ul").prepend(
            '<li><p>Query: ' + queryDesc
            + '<br>Actual Runtime: <font color="red">' + runtime + '</font>'
            + '<br>Expected Runtime: ' + sla
            + '<br>Cluster Size Ran: ' + clusterSize
            + '</p></li>');
    }
    else {
        $("#previousQueryList ul").prepend(
            '<li><p>Query: ' + queryDesc
            + '<br>Actual Runtime: <font color="green">' + runtime + '</font>'
            + '<br>Expected Runtime: ' + sla
            + '<br>Cluster Size Ran: ' + clusterSize
            + '</p></li>');
    }
}

function displayQueryError(error, query_id) {
    var pre = document.createElement('pre');
    multiline($('#runningInfo').empty().append(pre),
        "Error checking query status; it's probably done. Attempting to refresh\n" + error.responseText);
    setTimeout(function () {
        checkQueryStatus(query_id);
    }, 1000);
}

function checkQueryStatus(query_id) {
    var errFunc = function (error) {
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

function displayQueryStatus(query_status) {
    var t = editor_templates.query;
    var query_id = query_status['queryId'];
    var status = query_status['status'];
    var html = '';

    html += t.row({ name: 'Status', val: status });
    html += t.time_row({ name: 'Start', val: query_status['startTime'] });
    html += t.time_row({ name: 'End', val: query_status['finishTime'] });
    html += t.row({ name: 'Elapsed', val: query_status['elapsedNanos'] / 1000000000 });
    html = t.table({ myriaConnection: myriaConnection, query_id: query_id, content: html });

    if (status === 'SUCCESS' && query_status['profilingMode'].indexOf('QUERY') > -1) {
        html += t.prof_link({ query_id: query_id });
    } else if (status === 'ERROR') {
        html += t.err_msg({ message: query_status['message'] || '(missing)' });
    }
    $("#runningInfo").html(html);

    if (status === 'ACCEPTED' || status === 'RUNNING' || status === 'PAUSED' || status === 'KILLING') {
        setTimeout(function () {
            checkQueryStatus(query_id);
        }, 1000);
    }
}

/* Based on: http://stackoverflow.com/a/6455874/1715495 */
function multiline(elt, text) {
    var htmls = [];
    var lines = text.split(/\n/);
    // The temporary <div/> is to perform HTML entity encoding reliably.
    //
    // document.createElement() is *much* faster than jQuery('<div/>')
    // http://stackoverflow.com/questions/268490/
    //
    // You don't need jQuery but then you need to struggle with browser
    // differences in innerText/textContent yourself
    var tmpDiv = jQuery(document.createElement('div'));
    for (var i = 0; i < lines.length; i++) {
        htmls.push(tmpDiv.text(lines[i]).html());
    }
    elt.html(htmls.join("<br>"));
}

//To initialize
$(document).ready(function () {
    $("#pkTooltip").tooltip();
});