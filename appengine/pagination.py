import copy


QUERIES_PER_PAGE = 25
QUERIES = 'results'
QUERY_ID = 'queryId'
MAX = 'max'
MIN = 'min'
LIMIT = 'limit'
SEARCH = 'q'


class Pagination(object):

    def __init__(self, args, result):
        self.args = args
        self.result = result
        self.base_args = {}
        try:
            self.base_args[LIMIT] = int(self.args[LIMIT])
        except (KeyError, ValueError, TypeError):
            self.base_args[LIMIT] = QUERIES_PER_PAGE
        try:
            self.base_args[SEARCH] = self.args[SEARCH]
        except KeyError:
            pass

    @property
    def prev_args(self):
        q = self.result[QUERIES]
        ret = copy.copy(self.base_args)
        if not q:
            return ret

        current_max = q[0][QUERY_ID]
        if current_max < self.result[MAX]:
            ret[MIN] = current_max + 1

        return ret

    @property
    def has_next(self):
        q = self.result[QUERIES]
        if not q:
            return False

        return q[-1][QUERY_ID] > self.result[MIN]

    @property
    def next_args(self):
        assert self.has_next

        q = self.result[QUERIES]
        ret = copy.copy(self.base_args)
        if q:
            current_min = q[-1][QUERY_ID]
            ret[MAX] = current_min - 1

        return ret

    @property
    def can_jump(self):
        return SEARCH not in self.args

    def iter_pages(self, left_edge=2, left_current=3,
                   right_current=3, right_edge=2):

        # No explicit page numbers if we can't jump to a specific page
        if not self.can_jump:
            raise NotImplementedError("page iteration when we cannot jump")

        # The user's search had no results
        if self.result[QUERIES]:
            current_max = self.result[QUERIES][0][QUERY_ID]
        else:
            current_max = 0

        max_query = self.result[MAX]
        per_page = self.base_args[LIMIT]
        current_page = 1 + (max_query - current_max + per_page - 1) / per_page
        all_pages = current_page + ((current_max - 1) / per_page)
        last = 0
        for num in xrange(1, all_pages + 1):
            if (num <= left_edge or  # we show the first left_edge pages
                    (current_page - left_current <= num
                     <= current_page + right_current)  # +/- a few nearby
                    or num > all_pages - right_edge):  # and last right_edge
                if last + 1 != num:
                    yield None
                ret = copy.copy(self.base_args)
                ret[MAX] = current_max + (current_page - num) * per_page
                yield {'page': num,
                       'args': ret,
                       'current': num == current_page}
                last = num