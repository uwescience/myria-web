import subprocess
import sys
import unittest


class StyleTest(unittest.TestCase):
    "run flake8 with the right arguments and ensure all files pass"
    def test_style(self):
        try:
            execlude = [
                'ply',
                'networkx',
                'pyparsing.py',
                'parsetab.py',
                'test_myria_up.py'
            ]
            subprocess.check_output(
                ['flake8',
                 '--exclude='+','.join(execlude),
                 'appengine'],
                stderr=subprocess.STDOUT)
        except subprocess.CalledProcessError as e:
            print >> sys.stderr, e.output
            raise

if __name__ == '__main__':
    unittest.main()
