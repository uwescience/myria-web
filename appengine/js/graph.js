var graph = function (element, queryPlan) {
    // do all the chart stuff
    debug(queryPlan);

    var chartElement = d3.select('.chart');

    var networkVis = networkVisualization(chartElement, [], queryPlan);

    networkVis.update([]);

    var fragmentVis = fragmentVisualization(chartElement, 0, queryPlan);


    // Process the queryPlan
    var fragments = queryPlan.physicalPlan.fragments;
    for(var i=0; i<fragments.length; i++){
        var obj = fragments[i];
        getNode(obj);
    }

};



function getNode(fragment)
{
    var operators = fragment.operators;
    var workers = fragment.workers;
    var id = fragment.fragmentIndex;
    var pid = null

    for(var i=0; i<operators.length; i++){
        var obj = operators[i];
        if (obj.hasOwnProperty('argPf')) {
            pid = obj.argPf.index;
        } 
    }

    if (pid) {
        console.log("Fragment %d has parent %d", id, pid);
    } else {
        console.log("Fragment %d has no parents", id);
    }

}