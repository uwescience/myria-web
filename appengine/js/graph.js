var graph = function (element, queryPlan) {
    // do all the chart stuff
    debug(queryPlan);

    var chartElement = d3.select('.some-class');

    var networkVis = networkVisualization(chartElement, [], queryPlan);

    networkVis.update([]);

    var fragmentVis = fragmentVisualization(chartElement, 0, queryPlan);

    // var url =  'http://' + myriaConnection + '/query/query-' + queryId;

    // $.getJSON(url, function(data) {
    //     debug(data)
    // });
};