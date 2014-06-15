var nanosecondsToStr = function(nanoseconds) {
    // inspired by http://stackoverflow.com/questions/8211744/convert-time-interval-given-in-seconds-into-more-human-readable-form

    function numberEnding (number) {
        return (number > 1) ? 's' : '';
    }

    var temp = Math.floor(nanoseconds / 1000000000);
    var hours = Math.floor((temp %= 86400) / 3600);
    if (hours) {
        return hours + ' hour' + numberEnding(hours);
    }
    var minutes = Math.floor((temp %= 3600) / 60);
    if (minutes) {
        return minutes + ' minute' + numberEnding(minutes);
    }
    var seconds = temp % 60;
    return seconds + ' second' + numberEnding(seconds);
};

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
            items += templates.defItem({key: "Running time:", value: nanosecondsToStr(queryPlan.elapsedNanos)});
            items += templates.defItem({key: "# of shuffled tuples:", value: Intl.NumberFormat().format(totalTuple)});
            var dl = templates.defList({items: items});
            element.html(dl);
        });
};