EXAMPLE_DETAILS = {
    'begin': 40,
    'end': 350,
    'hierarchy': [
        {
            'type': "Join",
            'name': "join(x,y)",
            'states': [
                {
                    'begin': 40,
                    'end': 150,
                    'name': 'sleep'
                },
                {
                    'begin': 200,
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
                    'begin': 100,
                    'end': 170,
                    'name': 'sleep'
                },
                {
                    'begin': 250,
                    'end': 300,
                    'name': 'wait'
                }
            ],
            'children': [
                {
                    'type': "ShuffleProducer",
                    'name': "shuffleProducer1()",
                    'states': [
                        {
                            'begin': 120,
                            'end': 130,
                            'name': 'compute'
                        },
                        {
                            'begin': 230,
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
                            'begin': 100,
                            'end': 160,
                            'name': 'compute'
                        }
                    ],
                    'children': [{
                        'type': "MultiwayHashJoin",
                        'name': "join(x,z)",
                        'states': [
                            {
                                'begin': 40,
                                'end': 200,
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
                    'begin': 50,
                    'end': 60,
                    'name': 'sleep'
                },
                {
                    'begin': 100,
                    'end': 120,
                    'name': 'compute'
                }
            ],
            'children': []
        }
    ]
}

EXAMPLE_UTILIZATION = {
    'max': 3,
    'begin': 40,
    'end': 350,
    'data': [
        [40, 1], [50, 2], [60, 1], [100, 2], [100, 3],
        [120, 2], [150, 1], [170, 0], [200, 1], [350, 0]
    ]
}