from base_clang_backend import BaseClangBackend
from raco.language.grappalang import GrappaAlgebra
from raco.language.clangcommon import EMIT_FILE


class GrappaBackend(BaseClangBackend):

    def algebra(self):
        return GrappaAlgebra(emit_print=EMIT_FILE)

    def _backend_name(self):
        return "grappa"

    def _num_alive(self):
        return "?"

    def _num_workers(self):
        return "?"
