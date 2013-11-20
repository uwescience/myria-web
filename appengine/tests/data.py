EXAMPLE_DETAILS = {
    'begin': 4,
    'end': 35,
    'hierarchy': [
        {
            'type': "Join",
            'name': "join(x,y)",
            'states': [
                {
                    'begin': 4,
                    'end': 15,
                    'name': 'sleep'
                },
                {
                    'begin': 20,
                    'end': None,
                    'name': 'compute'
                }
            ],
            'children': []
        }, {
            'type': "MergeConsumer",
            'name': "mergeConsumer()",
            'states': [
                {
                    'begin': 10,
                    'end': 17,
                    'name': 'sleep'
                },
                {
                    'begin': 25,
                    'end': 30,
                    'name': 'wait'
                }
            ],
            'children': [
                {
                    'type': "ShuffleProducer",
                    'name': "shuffleProducer1()",
                    'states': [
                        {
                            'begin': 12,
                            'end': 13,
                            'name': 'compute'
                        },
                        {
                            'begin': 23,
                            'end': None,
                            'name': 'receive'
                        }
                    ],
                    'children': []
                }, {
                    'type': "ShuffeProducer",
                    'name': "shuffleProducer2()",
                    'states':[
                        {
                            'begin': 10,
                            'end': 16,
                            'name': 'compute'
                        }
                    ],
                    'children': [{
                        'type': "MultiwayHashJoin",
                        'name': "join(x,z)",
                        'states': [
                            {
                                'begin': 4,
                                'end': 20,
                                'name': 'send'
                            }
                        ],
                        'children': []
                    }]
                }
            ]
        }, {
            'type': "Union",
            'name': "union(a,b)",
            'states': [
                {
                    'begin': 5,
                    'end': 6,
                    'name': 'sleep'
                },
                {
                    'begin': 10,
                    'end': 12,
                    'name': 'compute'
                }
            ],
            'children': []
        }
    ]
}

EXAMPLE_UTILIZATION = {
    'max': 2,
    'begin': 4,
    'end': 35,
    'data': [
        [4, 1],
        [5, 2],
        [6, 1],
        [10, 2],
        [15, 1],
        [17, 0],
        [20, 1],
        [35, 0]
    ]
}