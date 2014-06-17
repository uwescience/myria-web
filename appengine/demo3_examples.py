import os


phytoplankton = '''OppData = scan(public:adhoc:all_opp_v3);
VctData = scan(public:adhoc:all_vct);

OppWithPop = select opp.*, vct.pop
             from OppData as opp,
                  VctData as vct
             where opp.Cruise = vct.Cruise
               and opp.Day = vct.Day
               and opp.File_Id = vct.File_Id
               and opp.Cell_Id = vct.Cell_Id;

PlanktonCount = select Cruise, count(*) as Phytoplankton
                from OppWithPop
                where pop != "beads" and pop != "noise"
                  and fsc_small > 10000;

store(PlanktonCount, public:demo:PlanktonCount);'''

sigma_clipping_naive = """Good = scan(public:adhoc:sc_points);

-- number of allowed standard deviations
const Nstd: 2;

do
    stats = [from Good emit avg(v) AS mean, stdev(v) AS std];
    NewBad = [from Good, stats where abs(Good.v - mean) > Nstd * std
              emit Good.*];
    Good = diff(Good, NewBad);
    continue = [from NewBad emit count(NewBad.v) > 0];
while continue;

store(Good, OUTPUT);
"""

pagerank ="""const alpha: .85;
const epsilon: .0001;

Edge = scan(public:adhoc:edges);
Vertex = scan(public:adhoc:vertices);

N = countall(Vertex);
MinRank = [(1 - alpha) / *N];

OutDegree = [from Edge emit Edge.src as id, count(Edge.dst) as cnt];
PageRank = [from Vertex emit Vertex.id as id, 1.0 / *N as rank];

do
    -- Calculate each node's outbound page rank contribution
    PrOut = [from PageRank, OutDegree where PageRank.id == OutDegree.id
             emit PageRank.id as id, PageRank.rank / OutDegree.cnt
             as out_rank];

    -- Compute the inbound summands for each node
    Summand = [from Vertex, Edge, PrOut
                where Edge.dst == Vertex.id and Edge.src == PrOut.id
                emit Vertex.id as id, PrOut.out_rank as summand];

    -- Sum up the summands; adjust by alpha
    NewPageRank = [from Summand emit id as id,
                   *MinRank + alpha * sum(Summand.summand) as rank];
    Delta = [from NewPageRank, PageRank where NewPageRank.id == PageRank.id
             emit ABS(NewPageRank.rank - PageRank.rank) as val];
    Continue = [from Delta emit max(Delta.val) > epsilon];
    PageRank = NewPageRank;
while Continue;

store(PageRank, OUTPUT);
"""

center_of_mass = """const PI: 3.14159;

def degrees_to_radians(d): d * PI / 180;
def radians_to_degrees(r): r * 180 / PI;
def hypotenuse(x, y): sqrt(x * x + y * y);

Points = scan(public:adhoc:lat_lon_points);
AsRads = [from Points emit degrees_to_radians(lat) as latr,
                           degrees_to_radians(lon) as lonr];
Cartesian = [from AsRads emit cos(latr) * cos(lonr) as x,
                              cos(latr) * sin(lonr) as y,
                              sin(latr) as z];
NumPoints = countall(Points);
WeightedAverage = [from Cartesian emit sum(x) / *NumPoints as xa,
                                       sum(y) / *NumPoints as ya,
                                       sum(z) / *NumPoints as za];
CoMr = [from WeightedAverage
        emit atan2(za, hypotenuse(xa, ya)) as latr,
             atan2(ya, xa) as lonr];
CoM = [from CoMr emit radians_to_degrees(latr) as lat,
                      radians_to_degrees(lonr) as lon];
store(CoM, OUTPUT);
"""

demo3_myr_examples = [
    ('Count large phytoplankton in SeaFlow data', phytoplankton),
    ('Geographic center of mass', center_of_mass),
    ('Pagerank', pagerank),
    ('Sigma-clipping (naive version)', sigma_clipping_naive)
]

demo3_examples = { 'datalog' : [], 'sql': [],
                   'myrial' : demo3_myr_examples
                 } 
