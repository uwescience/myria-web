Customizing Bootstrap for Myria
===============================

We customize Bootstrap's colors for use in `myria-web` (See [#25](https://github.com/uwescience/myria-web/issues/25)). Here we explain how this is done:

1. Check out Bootstrap and switch to the _tag_ matching the current release. At the time of writing, this is version 3.1.1.

    ```
    git clone https://github.com/twbs/bootstrap.git
    git checkout v3.1.1
    ```

2. The customizations are in this directory in `variables.less.diff`. To apply them, use the `patch` command in the `bootstrap` root directory.

    ```
    cd bootstrap    # go to the bootstrap root directory
    patch < [path-to-myria-web]/customize-bootstrap/variables.less.diff
    ```

3. Compile the `bootstrap` distribution. You should follow their instructions [here](https://github.com/twbs/bootstrap#compiling-css-and-javascript), but the key command is `grunt dist`.

4. Copy the modified `css` and `js` files to `myria-web`.

    ```
    cp dist/css/bootstrap.min.css [path-to-myria-web]/appengine/css/
    cp dist/js/bootstrap.min.js [path-to-myria-web]/appengine/js/
    ```

5. Check out the `myria-web` page.

## If you make further customizations

1. For styling, you should only need to edit `variables.less`. After making changes, you can follow steps 3&ndash;5 above to test them out.

2. Once you're happy, save the diff back here

    ```
    git diff variables.less > [path-to-myria-web]/customize-bootstrap/variables.less.diff
    ```
    
    and commit it.
    
    Also make sure you copy and commit the updated `css` and/or `js` files (if the Bootstrap version changed as well).