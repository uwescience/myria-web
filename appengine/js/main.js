var updateCalendarWarning = function() {
  var apiKey = "AIzaSyCIB8MWWVeix26boS_WLJGmW41A9oNj8fw";
  var calId = "cs.washington.edu_i1gk4il65dj31mcfgid1t9t1o8@group.calendar.google.com";

  var now = new Date(),
      soon = (new Date()).addHours(6),
      later = (new Date()).addDays(2);

  // warn if there are experiments running
  $.ajax({
    url: "https://www.googleapis.com/calendar/v3/freeBusy?key=" + apiKey,
    type: "POST",
    data: JSON.stringify({
      "timeMin": (now).toISOString(),
      "timeMax": (later).toISOString(),
      "timeZone": "UTC",
      "items": [
        {
          "id": calId
        }
      ]
    }),
    contentType: "application/json; charset=utf-8",
    dataType: "json",
    success: function(data){
      var message = '',
        start = later,
        end = now;

      // filter for events happening now
      var busyNow = _.filter(data.calendars[calId].busy, function(b) {
        var busy = new Date(b.start) < now && new Date(b.end) > now;
        if (busy && new Date(b.end) > new Date(end))
          end = b.end;
        return busy;
      }).length > 0;

      // filter by overlap with now and soon
      var busySoon = _.filter(data.calendars[calId].busy, function(b) {
        if (new Date(b.start) < new Date(start))
          start = b.start;
        return new Date(b.start) < soon && new Date(b.end) > now;
      }).length > 0;

      // filter by overlap with now and later
      var busyLater = _.filter(data.calendars[calId].busy, function(b) {
        if (new Date(b.start) < new Date(start))
          start = b.start;
        return new Date(b.start) < later && new Date(b.end) > now;
      }).length > 0;

      $("#calendar-alert").remove();

      if (busyNow) {
        message = '<div id="calendar-alert" class="alert alert-danger" role="alert"><strong>The Myria cluster is reserved for research experiments right now</strong>. Please don\'t use it! It will be available <abbr class="timeago" title="' + end + '">' + end + '</abbr>.'
      } else if (busySoon) {
        message = '<div id="calendar-alert" class="alert alert-warning" role="alert"><strong>Myria will be reserved for research experiments soon</strong>. The reservation will begin <abbr class="timeago" title="' + start + '">' + start + '</abbr>. Please only submit queries that will finish well before that time.'
      } else if (busyLater) {
        message = '<div id="calendar-alert" class="alert alert-info" role="alert"><strong>There is an upcoming reservation for research experiments</strong>. The reservation will begin <abbr class="timeago" title="' + start + '">' + start + '</abbr>.'
      } else {
        return;
      }

      $("#page-body").prepend(message + ' For more information, please check the <a target="_blank" href="https://www.google.com/calendar/embed?src=cs.washington.edu_i1gk4il65dj31mcfgid1t9t1o8%40group.calendar.google.com&ctz=America/Los_Angeles&mode=week">calendar</a>.</div>');
      jQuery("abbr.timeago").timeago();
    }
  });
}

$(function() {
  jQuery.timeago.settings.allowFuture = true;

  Date.prototype.addHours= function(h){
    this.setHours(this.getHours()+h);
    return this;
  };

  Date.prototype.addDays= function(d){
    this.setHours(this.getHours()+24*d);
    return this;
  };

  //warn if not in Chrome
  if (!window.chrome) {
    $("#page-body").prepend('<div class="alert alert-danger alert-dismissible" role="alert"><button type="button" class="close" data-dismiss="alert"><span aria-hidden="true">&times;</span><span class="sr-only">Close</span></button><strong>Warning!</strong> Myria is developed and tested in Google Chrome, and other browsers may not support all the features.</div>');
  }

  //warn if backend is not available
  if (connectionString.indexOf('error') === 0) {
    $("#page-body").prepend('<div class="alert alert-danger alert-dismissible" role="alert"><strong>Error!</strong> Unable to connect to Myria. Most functionality will not work.</div>');
  }

  //warn if myria cluster has scheduled calendar use
  if (connectionString.indexOf('localhost') === -1) {
    window.setInterval(updateCalendarWarning, 5 * 60 * 1000);
    updateCalendarWarning();
  }

  //back to top button
  var offset = 220;
  var duration = 300;
  $('.back-to-top').hide();
  $(window).scroll(function() {
    if ($(this).scrollTop() > offset) {
      $('.back-to-top').fadeIn(duration);
    } else {
      $('.back-to-top').fadeOut(duration);
    }
  });

  $('.back-to-top').click(function(event) {
    event.preventDefault();
    $('html, body').animate({scrollTop: 0}, duration);
    return false;
  });

  $("[data-toggle=tooltip]").tooltip();

  $("abbr.timeago").timeago();
});
