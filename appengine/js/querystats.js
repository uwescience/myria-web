var updateQueryStats = function(element) {
    var shuffleUrl = templates.urls.aggregatedSentData({
            myria: myriaConnection,
            query: queryPlan.queryId
        });

    d3.csv(shuffleUrl, function(d) {
            d.numTuples = +d.numTuples;
            return d;
        }, function (data) {
            $(element.node()).empty();
            var div = element.append("div")
                .attr("class", "query-stats");
            var h = div.append("h4")
                .text("Query stats:");
            var totalTuple = data.reduce(function(a,b){
                return a + b.numTuples;
            }, 0);
            var items = "";
            items += templates.defItem({key: "Running time:", value: customFullTimeFormat(queryPlan.elapsedNanos, false)});
            items += templates.defItem({key: "# shuffled tuples:", value: Intl.NumberFormat().format(totalTuple)});
            var dl = templates.defList({items: items});
            $(".query-stats").append(dl);
        });
};