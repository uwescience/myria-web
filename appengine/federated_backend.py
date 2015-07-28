from backend import Backend


class FederatedBackend(Backend):
    def get_query_status(self, query_id):
        super(FederatedBackend, self).get_query_status(query_id)

    def catalog(self):
        super(FederatedBackend, self).catalog()

    def execute_query(self, query, logical_plan, physical_plan, language=None,
                      profile=False):
        super(FederatedBackend, self).execute_query(query, logical_plan,
                                                    physical_plan, language,
                                                    profile)

    def connection_info(self):
        super(FederatedBackend, self).connection_info()

    def compile_query(self, query, physical_plan, language=None):
        super(FederatedBackend, self).compile_query(query, physical_plan,
                                                    language)

    def connection_url(self, uri_scheme="http"):
        return super(FederatedBackend, self).connection_url(uri_scheme)

    def backend_url(self):
        super(FederatedBackend, self).backend_url()

    def queries(self, limit, max_id, min_id, q):
        super(FederatedBackend, self).queries(limit, max_id, min_id, q)

    def algebra(self):
        super(FederatedBackend, self).algebra()