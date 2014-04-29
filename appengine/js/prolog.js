CodeMirror.defineMode("prolog", function() {
  return {
    startState: function() {
      return { in_comment:0 };
    },
    token: function(stream,state) {
      var token_name;
      if (state.in_comment) {
        token_name = 'comment';
        if (stream.match("*/"))
          state.in_comment--;
        else if (stream.match("/*"))
          state.in_comment++;
        else
          stream.next();
      } else if (stream.match("/*")) {
        token_name = 'comment';
        state.in_comment++;
      } else if (stream.match(/[a-z][A-Za-z0-9_]*/))
        token_name = 'atom';
      else if (stream.match(/\'(\\\'|[^\'])*\'/))
        token_name = 'atom';
      else if (stream.match(/\"(\\\"|[^\"])*\"/))
        token_name = 'string';
      else if (stream.match(/0'./))
        token_name = 'string-2';
      else if (stream.match(/[A-Z_][A-Za-z0-9_]*/))
        token_name = 'variable-2';
      else if (stream.match(/[0-9]+(\.[0-9]+)?/))
        token_name = 'number';
      else if (stream.match(/[\+\-\*\/\=\^<>~:\.\?@#$\\&{}`]+/))
        token_name = 'operator';
      else
        if (stream.next() === '%') {
          stream.skipToEnd();
          token_name = 'comment';
        }
      return token_name;
    }
  };
});