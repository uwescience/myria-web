def get_utilization(details):
    utilization = {
        'begin': details['begin'],
        'end': details['end']
    }

    transitions = []

    for item in details['hierarchy']:
        for state in item['states']:
            if state['name'] in ['compute', 'sleep']:
                end = state['end']
                if not end:
                    end = details['end']
                transitions.append({'time': state['begin'], 'begin': True})
                transitions.append({'time': end, 'begin': False})

    transitions.sort(key=lambda x: x['time'])

    data = []

    # sweeping through all state transitions
    number = 0
    max_number = 0
    for trans in transitions:
        if trans['begin']:
            number += 1
        else:
            number -= 1
        max_number = max(max_number, number)
        data.append([trans['time'], number])

    utilization['max'] = max_number
    utilization['data'] = data

    return utilization
