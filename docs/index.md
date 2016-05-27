---
layout: default
title: Myria Web
group: "docs"
weight: 1
section: 5
---

# Myria-Web

In Myria-Web, you will see an editor where you can write MyriaL or SQL queries and execute them with Myria. At the top of the screen, you should see three tabs: "Editor", "Queries", and "Datasets".

Here is a quick tour of the interface:

- Click on the **Datasets** tab. Here, you can see the list of all the datasets currently ingested
and available in the service. You can click on the name of a dataset to see its metadata
including the schema.  Click on "JSON", "CSV", or "TSV" to download the dataset in the
specified format.

- Now click on the **Queries** tab. This is where you can see all the queries that yourself
and others have been running. Observe the keyword search window. After you run the example
query below, type the word "Twitter" to see all queries executed on the `public:adhoc:Twitter` relation.

- Finally, click on the **Editor** tab. This is where you can write and execute queries.
You can start from one of the examples on the right. Click on the example and the
query will appear in the editor window. Queries can be written in SQL or MyriaL. We
recommend MyriaL because, in that mode, you can inter-twine SQL and MyriaL in your
script.

Try the following query, which ingests a dataset from S3, stores it in the relation `public:adhoc:Twitter`:

    Twitter = LOAD("https://s3-us-west-2.amazonaws.com/myria/public-adhoc-TwitterK.csv", csv(schema(column0:int, column1:int), skip=1));
    STORE(Twitter, public:adhoc:Twitter, [$0]);

The query below computes an aggregate that it stores in a relation called `public:adhoc:Followers`:

    Twitter = SCAN(public:adhoc:Twitter);
    Followers = SELECT $0, COUNT($1) FROM Twitter;
    STORE(Followers, public:adhoc:Followers, [$0]);

(The third argument in the `STORE` statement means to hash-partition the data on the first attribute and store it hash-partitioned across all worker instances.)

First click on "Parse". This will show you the query plan that Myria will
execute. Then click on "Execute Query". This will execute the query and
produce a link to the output.

Now select  the "Profile Query" option below the query window and
re-execute the query with the option ON.  Below the result, you will
see the "Profiling results". Click on it. It wil show you profiling information
about the way the query executed. Explore the output of the profiler.

## Perfopticon

The query execution debugger is described in our paper. Please see [https://idl.cs.washington.edu/papers/perfopticon/](https://idl.cs.washington.edu/papers/perfopticon/).

# MyriaL

The above examples use MyriaL. For more information, please see [http://myria.cs.washington.edu/docs/myrial.html](http://myria.cs.washington.edu/docs/myrial.html).
