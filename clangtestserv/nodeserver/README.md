# Setup
In server.js:
* Set the compilepath to the path of raco/c_test\_environment
* Set hostname and port to the server's hostname and port

In datastore.js:
* Set raco_path and grappa\_path to that of raco and grappa respectively

Inserting datasets:
* Create a csv file (1 dataset entry per line)
* File format for csv should be: user name, program name, relation name, uri (for clang it is http:\\hostname:port), number of tuples, list of column names, list of column types, backend the data can be used on
* Run the command:
```./datastore.py insert_new_data -p ``` (filename.csv)

# Run the clang/grappa server
node server.js
