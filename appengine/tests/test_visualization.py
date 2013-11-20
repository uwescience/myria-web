from nose.tools import assert_equal
import states_to_utilization as conv
from data import EXAMPLE_DETAILS, EXAMPLE_UTILIZATION


def test_conversion():
    utilization = conv.get_utilization(EXAMPLE_DETAILS)
    assert_equal(utilization, EXAMPLE_UTILIZATION)
