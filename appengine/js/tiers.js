(function () {

    var app = angular.module('tiersDemo', []);

    // Switching out symbols to prevent conflict with Jinja
    app.config(function ($interpolateProvider) {
        $interpolateProvider.startSymbol('{[{').endSymbol('}]}');
    });

        app.filter('keys', function () {
        return function (input) {
            if (!input) {
                return [];
            }

            return Object.keys(input);
        }
    });

    app.controller('WizardController', ['$http', 'filterFilter', 'orderByFilter', function (http, filter, orderBy) {
        this.tiers = [{ "id": 1,"name": "1", "cost": "0.16" }, { "id": 5, "name": "2", "cost": ".64" }]

        this.tier = 0;
        this.allQueries = null;
        this.queryCache = [];
        this.executionLog = '';
        this.step = 1;



        this.setTier = function (tier) {
            this.tier = tier;
            localStorage.setItem("tier", tier-1);
        };

        this.getTierWizard = function (tier) {
            currentTier = localStorage.getItem("tier");
            if(currentTier == 0)
            {
                return this.tiers[0]
            }
            else
            {
                return this.tiers[1]
            }

            //return this.tiers[currentTier]
        };

        this.loadQueries = function () {
            var internal = this;

            http.get('/data/psla.json').success(function (result) {
                internal.allQueries = result.queries;
                internal.step++;
            });
        };

        this.getQueriesForTier = function (tier) {
            if (!this.allQueries)
                return;

            if (this.queryCache[tier])
                return this.queryCache[tier];

            var filteredQueries = filter(this.allQueries, {
                tier: tier
            });

            var orderedQueries = orderBy(filteredQueries, function (query) {
                return query.runtime;
            });

            var groupedQueries = {};
            for (var query in orderedQueries) {
                var group = 'g' + orderedQueries[query].runtime;

                if (groupedQueries[group] == null)
                    groupedQueries[group] = [];

                groupedQueries[group].push(orderedQueries[query]);
                groupedQueries[group].runtime = orderedQueries[query].runtime;
            }

            this.queryCache[tier] = groupedQueries;

            return groupedQueries;
        };

        this.log = function (text) {
            this.executionLog = text + '\n';
        };

    }]);

})();