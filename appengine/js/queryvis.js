var state_colors = {
    "sleep": "#c7c7c7",
    "compute": "#ff7f0e",
    "wait": "#ffbb78",
    "receive": "#fd8d3c",
    "send": "#2ca02c"
};

var boxTemplate = _.template("Duration: <%- duration %><br/>Begin: <%- begin %><br/>End: <%- end %>"),
    titleTemplate = _.template("<strong><%- name %></strong> <small><%- type %></small>"),
    stateTemplate = _.template("<span style='color: <%- color %>'><%- state %></span>: <%- time %>"),
    chartTooltipTemplate = _.template("Time: <%- time %> #: <%- number %>"),
    ganttTooltipTemplate = _.template("Time: <%- time %>");

var animationDuration = 750;

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
  [d3.time.format("%H:%M:%S"), function(d) { return true; }],
  [d3.time.format("%H:%M:%S"), function(d) { return d.getMinutes(); }],
  [d3.time.format(":%S.%L"), function(d) { return d.getSeconds(); }],
  [d3.time.format(".%L"), function(d) { return d.getMilliseconds(); }]
]);

function divmod(a, b) {
    return [Math.floor(a/b), a%b];
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

var ruler = d3.select("body")
    .append("div")
    .attr("class", "ruler");

// use data bindings to attach charts
d3.selectAll('.chart').each(function() {
    element = d3.select(this);
    var type = element.attr('data-type');
    if (type === 'gantt') {
        ganttChart(element);
    } else if (type === 'line') {
        lineChart(element, 10);
    }
});
