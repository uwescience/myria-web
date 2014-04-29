CodeMirror.defineMode("myrial", function(conf, parserConf) {
    var ERRORCLASS = 'error';

    function wordRegexp(words) {
        return new RegExp("^((" + words.join(")|(") + "))\\b");
    }

    var singleOperators = parserConf.singleOperators || new RegExp("^[\\+\\-\\*/%&|\\^~<>!]");
    var singleDelimiters = parserConf.singleDelimiters || new RegExp('^[\\(\\)\\[\\]\\{\\}@,:`=;\\.]');
    var doubleOperators = parserConf.doubleOperators || new RegExp("^((==)|(<=)|(>=)|(<>)|(//))");
    var identifiers = parserConf.identifiers|| new RegExp("^[_A-Za-z][_A-Za-z0-9]*|\\$[0-9]+|\\*");
    var brackets = new RegExp("^[\\(\\)\\[\\]\\{\\}]")
    var hangingIndent = parserConf.hangingIndent || parserConf.indentUnit;

    var comprehensionKeywords = myrialKeywords.comprehension_keywords;
    var commonKeywords = myrialKeywords.keywords;
    var commonBuiltins = myrialKeywords.builtins;

    if(parserConf.extra_keywords != undefined){
        commonKeywords = commonKeywords.concat(parserConf.extra_keywords);
    }

    if(parserConf.extra_builtins != undefined){
        commonBuiltins = commonBuiltins.concat(parserConf.extra_builtins);
    }

    var keywords = wordRegexp(comprehensionKeywords.concat(commonKeywords));
    var builtins = wordRegexp(commonBuiltins);
    var types = wordRegexp(myrialKeywords.types);
    var wordOperators = wordRegexp(myrialKeywords.word_operators);

    // tokenizers
    function tokenBase(stream, state) {
        if (stream.eatSpace()) {
            return null;
        }

        // Handle Comments
        if (stream.match(/^--/)) {
            stream.skipToEnd();
            return 'comment';
        }

        // Handle Number Literals
        if (stream.match(/^[0-9\.]/, false)) {
            var floatLiteral = false;
            // Floats
            if (stream.match(/^\d*\.\d+(e[\+\-]?\d+)?/i)) { floatLiteral = true; }
            if (stream.match(/^\d+\.\d*/)) { floatLiteral = true; }
            if (stream.match(/^\.\d+/)) { floatLiteral = true; }
            if (floatLiteral) {
                // Float literals may be "imaginary"
                stream.eat(/J/i);
                return 'number';
            }
            // Integers
            var intLiteral = false;
            // Hex
            if (stream.match(/^0x[0-9a-f]+/i)) { intLiteral = true; }
            // Binary
            if (stream.match(/^0b[01]+/i)) { intLiteral = true; }
            // Octal
            if (stream.match(/^0o[0-7]+/i)) { intLiteral = true; }
            // Decimal
            if (stream.match(/^[1-9]\d*(e[\+\-]?\d+)?/)) {
                // Decimal literals may be "imaginary"
                stream.eat(/J/i);
                // TODO - Can you have imaginary longs?
                intLiteral = true;
            }
            // Zero by itself with no other piece of number.
            if (stream.match(/^0(?![\dx])/i)) { intLiteral = true; }
            if (intLiteral) {
                // Integer literals may be "long"
                stream.eat(/L/i);
                return 'number';
            }
        }

        // Handle Strings
        if (stream.peek() === '"') {
            stream.eat('"');
            state.tokenize = tokenStringFactory();
            return state.tokenize(stream, state);
        }

        //handle brackets
        if (stream.match(brackets)) {
            return 'bracket';
        }

        // Handle operators and Delimiters
        if (stream.match(doubleOperators)
            || stream.match(singleOperators)
            || stream.match(wordOperators)) {
            return 'operator';
        }

        if (stream.match(singleDelimiters)) {
            return null;
        }

        if (stream.match(keywords)) {
            return 'keyword';
        }

        if (stream.match(types)) {
            return 'variable-2';
        }

        if (stream.match(builtins)) {
            return 'builtin';
        }

        if (stream.match(identifiers)) {
            if (state.lastToken === 'def' || state.lastToken === 'apply') {
                return 'def';
            }
            return 'variable';
        }

        // Handle non-detected items
        stream.next();
        return ERRORCLASS;
    }

    function tokenStringFactory() {
        var OUTCLASS = 'string';

        function tokenString(stream, state) {
            while (!stream.eol()) {
                stream.eatWhile(/[^"]/);
                if (stream.match('"')) {
                    state.tokenize = tokenBase;
                    return OUTCLASS;
                } else {
                    stream.eat(/["]/);
                }
            }
            if (parserConf.singleLineStringErrors) {
                return ERRORCLASS;
            } else {
                state.tokenize = tokenBase;
            }
            return OUTCLASS;
        }
        tokenString.isString = true;
        return tokenString;
    }

    function tokenLexer(stream, state) {
        var style = state.tokenize(stream, state);
        var current = stream.current();

        // Handle '.' connected identifiers
        if (current === '.') {
            style = stream.match(identifiers, false) ? null : ERRORCLASS;
            if (style === null && state.lastStyle === 'meta') {
                // Apply 'meta' style to '.' connected identifiers when
                // appropriate.
                style = 'meta';
            }
            return style;
        }

        return style;
    }

    var external = {
        startState: function(basecolumn) {
            return {
              tokenize: tokenBase,
              scopes: [{offset:basecolumn || 0, type:'myrial'}],
              lastStyle: null,
              lastToken: null
          };
        },

        token: function(stream, state) {
            var style = tokenLexer(stream, state);

            state.lastStyle = style;

            var current = stream.current();
            if (current && style) {
                state.lastToken = current;
            }
            return style;
        },

        lineComment: "--"
    };
    return external;
});

CodeMirror.defineMIME("text/x-myrial", "myrial");