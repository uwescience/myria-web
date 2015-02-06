// put all the underscore templates here
var templates = {
    //*/
    urls: {
        sentData: _.template("<%- myria %>/logs/sent?queryId=<%- query %>&subqueryId=<%- subquery %>&fragmentId=<%- fragment %>"),
        aggregatedSentData: _.template("<%- myria %>/logs/aggregated_sent?queryId=<%- query %>&subqueryId=<%- subquery %>"),
        profiling: _.template("<%- myria %>/logs/profiling?queryId=<%- query %>&subqueryId=<%- subquery %>&fragmentId=<%- fragment %>&start=<%- start %>&end=<%- end %>&onlyRootOp=<%- onlyRootOp %>&minLength=<%- minLength %>"),
        range: _.template("<%- myria %>/logs/range?queryId=<%- query %>&subqueryId=<%- subquery %>&fragmentId=<%- fragment %>"),
        contribution: _.template("<%- myria %>/logs/contribution?queryId=<%- query %>&subqueryId=<%- subquery %>&fragmentId=<%- fragment %>"),
        histogram: _.template("<%- myria %>/logs/histogram?queryId=<%- query %>&subqueryId=<%- subquery %>&fragmentId=<%- fragment %>&start=<%- start %>&end=<%- end %>&step=<%- step %>&onlyRootOp=<%- onlyRootOp %>")
    },
    /*/
    urls: {
        sentData: _.template("/data/sent_<%- query %>_<%- fragment %>.csv"),
        profiling: _.template("/data/profiling_<%- query %>_<%- fragment %>.csv"),
        histogram: _.template("/data/histogram_<%- query %>_<%- fragment %>.csv")
    },/**/
    titleTemplate: _.template("<strong><%- name %></strong> <small><%- type %></small>"),
    stateTemplate: _.template("<span style='color: <%- color %>'><%- state %></span>: <%- time %>"),
    duration: _.template("<br/>took <%- duration %>"),
    numTuplesTemplate: _.template("<br/><%- numTuples %> tuples returned"),
    nullReturned: _.template("<br/>null returned"),
    chartTooltipTemplate: _.template("Time: <%- time %>, #: <%- number %>"),
    ganttTooltipTemplate: _.template("Time: <%- time %>"),
    graphViz: {
        nodeStyle: _.template('[style="rounded, filled",color="<%- color %>",shape=box,label="<%- label %>"];\n'),
        clusterStyle: _.template('\n\tsubgraph cluster_<%- fragment %> {\n\t\tstyle="rounded, filled";\n\t\tcolor=lightgrey;\n\t\tlabel="<%- label %>";\n\t\tnode [style=filled,color=white];\n'),
        link: _.template("\t\"<%- u %>\" -> \"<%- v %>\";\n")
    },
    nwTooltip: _.template("<%- numTuples %> tuples from <%- src %> to <%- dest %>"),
    nwPointTooltip: _.template("<%- numTuples %> tuples at time <%- time %>"),
    nwLineTooltip: _.template("from <%- src %> to <%- dest %>"),
    barTooltip: _.template("Worker: <%- worker %>, # Tuples: <%- numTuples %>"),
    titleNetworkVis: _.template("Communication between workers from fragment <%- src %> to fragment <%- dst %>"),
    titleFragmentsVis: _.template("Operators inside fragment <%- fragment %>"),
    titleFragmentsOverview: _.template("Overview over all fragments"),
    fragmentTitle: _.template("Fragment <%- fragment %>"),
    markerUrl: _.template("url(#<%- name %>)"),
    table: _.template('<div class="table-responsive"><table class="table table-striped table-condensed"><tbody><%= body %></tbody></table></div>'),
    row: _.template('<tr><th><%- key %></th><td><%= value %></td></tr>'),
    networkVisFrames:
        '<div class="row">\
            <div class="col-md-12">\
                <h3>Summary</h3><p class="summary"></p>\
            </div>\
        </div>\
        <div class="row"><div class="col-md-12 controls form-inline"></div></div>\
        <div class="row">\
            <div class="col-md-12 matrix"></div>\
        </div>',
    fragmentVisFrames:
        '<h4>Query time contribution <a href="#contribCollapsible" data-toggle="collapse"><small>collapse/expand</small></a></h4>\
        <div class="contrib collapse in" id="contribCollapsible"></div>\
        <h4>Detailed execution</h4>\
        <div class="details" id="detailsCollapsible"></div>',
    defList: _.template('<dl class="dl-horizontal"><%= items %></dl>'),
    defItem: _.template('<dt><%- key %></dt><dd><%- value %></dd>'),
    strong: _.template('<strong><%- text %></strong>'),
    code: _.template('<pre><%- code %></pre>')
};

// Dictionary of operand name -> color
var opToColor = {};

// Color pallet
var opColors = d3.scale.category20();

var animationDuration = 500,
    shortDuration = 200,
    longDuration = 800,
    delayTime = 20;

var dpi = 96;

var customTimeFormatD3 = d3.time.format.utc.multi([
  [".%L sec", function(d) { return d.getMilliseconds() && !d.getSeconds(); }],
  ["%S.%L sec", function(d) { return d.getMilliseconds(); }],
  ["%S sec", function(d) { return d.getSeconds(); }],
  ["%M min", function(d) { return d.getMinutes(); }],
  ["%H", function(d) { return true; }]
]);

function customTimeFormat(date) {
    if (date === 0) {
        return "0";
    }
    if (date % 1e6 !== 0) {
        return (date % 1e6).toExponential(2) + " ns";
    }

    return customTimeFormatD3(new Date(date/1e6));
}

String.prototype.hashCode = function(){
    var hash = 0, i, char;
    if (this.length === 0) return hash;
    for (i = 0, l = this.length; i < l; i++) {
        char  = this.charCodeAt(i);
        hash  = ((hash<<5)-hash)+char;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
};

function divmod(a, b) {
    return [Math.floor(a/b), a%b];
}

function debug(d) {
    console.log(d);
}

function customFullTimeFormat(d, detail) {
    if (d === 0) {
        return "0";
    }
    var str = "", ns, us, ms, s, m, h, x;
    if (detail === undefined) {
        detail = true;
    }

    x = divmod(d, 1000);
    ns = x[1];
    x = divmod(x[0], 1000);
    us = x[1];
    x = divmod(x[0], 1000);
    ms = x[1];
    x = divmod(x[0], 60);
    s = x[1];
    x = divmod(x[0], 60);
    m = x[1];
    h = x[0];
    // time_objs is an array of triples: an int constant, a unit string, and an
    // optional function that stringifies the constant when the output string
    // has already been prefixed by another nonzero unit.
    var time_objs = [
        [h, 'h', null],
        [m, 'm', null],
        [s, 's', null],
        [ms, 'ms', d3.format("03d")],
        [us, 'µs', d3.format("03d")],
        [ns, 'ns', d3.format("03d")]
    ];

    function id(x) { return x; } // the identify function
    var old_str = "";
    for (var i = 0, f = id; i < time_objs.length; ++i) {
        var to = time_objs[i];
        if (to[0]) {
            if (old_str) {
                str += " ";
                f = to[2] || f;
            }
            str += f(to[0]) + " " + to[1];
        }
        if (!detail && old_str) {
            return str;
        }
        old_str = str;
    }
    return str;
}

var largeNumberFormat = d3.format(",");

var ruler = d3.select("body")
    .append("div")
    .attr("class", "ruler");

var defaultNumSteps = 1000;

// if a range longer than this time is requests in the fragment visualization, then the
// data is limited to root operators
var maxTimeForDetails = 100 * 1e9;

// reconstruct all data, the data from myria has missing values where no workers were active
function reconstructFullData(incompleteData, start, end, step, nested) {
    if (!nested) {
        incompleteData = [{ key: "foo", values: incompleteData }];
    }

    var range = _.range(start, end, step),
        result = {};

    result = _.map(incompleteData, function(op) {
        var indexed = _.object(_.map(op.values, function(x){ return [x.nanoTime, x.numWorkers]; })),
            c = 0,
            data = [];

        _.each(range, function(d) {
            var value = indexed[d];
            if (value !== undefined) {
                c++;
            }
            data.push({
                nanoTime: d,
                numWorkers: value !== undefined ? value : 0
            });
        });

        if (c != op.values.length) {
            //debug(incompleteData);
            //debug(data);
            //debug(range);
            console.error("Incomplete data");
        }

        return {
            key: op.key,
            values: data
        };
    });

    if (!nested) {
        return result[0].values;
    }

    return result;
}

function nameMappingFromFragments(fragments) {
    var idNameMapping = {};
    _.each(fragments, function(frag) {
        _.each(frag.operators, function(op) {
            var hasName = _.has(op, 'opName') && op.opName;
            idNameMapping[op.opId] = hasName ? op.opName.replace("Myria", "") : op.opId;
        });
    });
    return idNameMapping;
}
