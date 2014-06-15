var updateQueryStats = function(element){
    //fragment=-1 means getting all the data
    var shuffleUrl = templates.urls.sentData({
            myria: myriaConnection,
            query: queryPlan.queryId,
            fragment: -1
        });

    d3.csv(shuffleUrl, function(d) {
            d.numTuples = +d.numTuples;
            return d;
        }, function (data) {
            var totalTuple = 0;
            for(var i=0, len=data.length; i<len; i++){
                totalTuple += data[i].numTuples;
            }
            var items = "";
            items += templates.defItem({key: "Running time:", value: customFullTimeFormat(queryPlan.elapsedNanos)});
            items += templates.defItem({key: "# shuffled tuples:", value: Intl.NumberFormat().format(totalTuple)});
            var dl = templates.defList({items: items});
            element.html(dl);
        });
};