// put all the underscore templates here
var templates = {
    /*/
    urls: {
        sentData: _.template("http://<%- myria %>/logs/sent?queryId=<%- query %>&fragmentId=<%- fragment %>"),
        profiling: _.template("http://<%- myria %>/logs/profiling?queryId=<%- query %>&fragmentId=<%- fragment %>"),
        histogram: _.template("http://<%- myria %>/logs/histogram?queryId=<%- query %>&fragmentId=<%- fragment %>")
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
    numTuplesTemplate: _.template("<%- numTuples %> tuples returned"),
    nullReturned: _.template("null returned"),
    chartTooltipTemplate: _.template("Time: <%- time %>, #: <%- number %>"),
    ganttTooltipTemplate: _.template("Time: <%- time %>"),
    graphViz: {
        nodeStyle: _.template("[style=\"rounded, filled\",color=\"<%- color %>\",shape=box];\n"),
        clusterStyle: _.template("\n\tsubgraph cluster_<%- fragment %> {\n\t\tstyle=\"rounded, filled\";\n\t\tcolor=lightgrey;\n\t\tnode [style=filled,color=white];\n\t\tlabel = \"<%- fragment %>\";\n"),
        link: _.template("\t\"<%- u %>\" -> \"<%- v %>\";\n")
    },
    nwTooltip: _.template("<%- sumTuples %> tuples from <%- src %> to <%- dest %>"),
    nwPointTooltip: _.template("<%- numTuples %> tuples at time <%- time %>"),
    nwLineTooltip: _.template("from <%- src %> to <%- dest %>"),
    titleNetworkVis: _.template("Communication between workers from fragment <%- src %> to fragment <%- dst %>"),
    titleFragmentsVis: _.template("Operators inside fragment <%- fragment %>"),
    titleFragmentsOverview: _.template("Overview over all fragments"),
    fragmentTitle: _.template("Fragment <%- fragment %>:"),
    markerUrl: _.template("url(#<%- name %>)"),
    table: _.template('<div class="table-responsive"><table class="table table-striped table-condensed"><tbody><%= body %></tbody></table></div>'),
    row: _.template('<tr><th><%- key %></th><td><%- value %></td></tr>'),
    opname: _.template('<strong><%- name %>: </strong>')
}

// Dictionary of operand name -> color
var opToColor = {};

// Color pallet
var opColors = d3.scale.category20();

var animationDuration = 750
    shortDuration = 500,
    longDuration = 1000;

var dpi = 96;

function timeFormat(formats) {
  return function(date) {
    var i = formats.length - 1, f = formats[i];
    while (!f[1](date)) f = formats[--i];
    return f[0](date);
  };
}

function timeFormatNs(formats) {
  return function(date) {
    if (date % 1e6 !== 0) {
        return (date % 1e6).toExponential(2) + " ns";
    }

    return timeFormat(formats)(new Date(date/1e6 + new Date().getTimezoneOffset() * 6e4));
  };
}

var customTimeFormat = timeFormatNs([
  [d3.time.format("%H:%M"), function(d) { return true; }],
  [d3.time.format("%H:%M:%S"), function(d) { return d.getMinutes(); }],
  [d3.time.format(":%S.%L"), function(d) { return d.getSeconds(); }],
  [d3.time.format(".%L"), function(d) { return d.getMilliseconds(); }]
]);

String.prototype.hashCode = function(){
    var hash = 0, i, char;
    if (this.length == 0) return hash;
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

function customFullTimeFormat(d) {
    var str = "", ms, ns, s, m, h, x;

    x = divmod(d, 1e6);
    ns = x[1];
    x = divmod(x[0], 1000);
    ms = x[1];
    x = divmod(x[0], 60);
    s = x[1];
    x = divmod(x[0], 60);
    m = x[1];
    h = x[0];

    if (h) {
        str += h + " H ";
    }
    if (m) {
        str += m + " m ";
    }
    if (s) {
        str += s + " s ";
    }
    if (ms) {
        if (s) {
            str += d3.format("03d")(ms) + " ms ";
        } else {
            str += ms + " ms ";
        }
    }
    str += d3.format("06d")(ns) + " ns ";
    return str;
}

var largeNumberFormat = d3.format(",")

var ruler = d3.select("body")
    .append("div")
    .attr("class", "ruler");

d3.select('.query-plan').each(function() {
    element = d3.select(this);
    graph(element, queryPlan);
});
