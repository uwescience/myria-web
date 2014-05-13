$(function() {
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

  $(window).resize(function() {
    updateExamplesHeight();
  });
});

updateExamplesHeight = function() {
  // the height of the footer and header + nav is estimated, so is the height of the tabbar and the description
  $('#examples-list').height(_.max([$(window).height() - 250, $('#editor-column').height() - 100]));
};
