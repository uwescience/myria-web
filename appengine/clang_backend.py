from base_clang_backend import BaseClangBackend
from raco.language.clangcommon import EMIT_FILE
from raco.language.clang import CCAlgebra


class ClangBackend(BaseClangBackend):

    def algebra(self):
        return CCAlgebra(emit_print=EMIT_FILE)

    def _backend_name(self):
        return "clang"

    def _num_alive(self):
        return "1"

    def _num_workers(self):
        return "1"
