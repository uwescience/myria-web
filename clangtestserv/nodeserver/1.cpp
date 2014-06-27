// Precount_select: Use buckets to track the number of matches
// Use buckets to copy into the result array
#include <stdio.h>
#include <stdlib.h>     // for exit()
#include <fcntl.h>      // for open()
#include <unistd.h>     // for close()
#include <sys/stat.h>   // for fstat()
#include <ctype.h>      // for isdigit()
#include <string.h>
#include <errno.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <sys/file.h>

#ifdef __MTA__
#include <machine/runtime.h>
#include <luc/luc_common.h>
#include <snapshot/client.h>
#include <sys/mta_task.h>


typedef int int64;
typedef unsigned uint64;
#else
#include <sys/time.h>

#include <cstdint>
#include <iostream>
typedef int64_t int64;
typedef uint64_t uint64;
 
#include <unordered_map>
#include <vector>
#endif

#include "io_util.h"
#include "counters_util.h"
#include "hash.h"
#include "utils.h"
#include "strings.h"

// ------------------------------------------------------------------

#define Subject   0
#define Predicate 1
#define Object    2
#define Graph     3

#define XXX  330337405
#define YYY 1342785348
#define ZZZ 1395042699

#define buckets 100000

uint64_t emit_count=0;

const uint64 mask = (1L << 53) - 1;
/*
// Insert a value into a hash table
void insert(uint64 **ht1, uint64 size1, uint64 offset)
{
  uint64 hash = (uint64(offset) & mask) % size1;
#ifdef __MTA__
  while (1) {
    if (!readff(ht1 + hash)) {
      uint64 *p = readfe(ht1 + hash); // lock it
      if (p) writeef(ht1 + hash, p); // unlock and try again
      else break;
    }
    hash++;
    if (hash == size1)
    hash = 0;
  }
  writeef(ht1 + hash, relation2 + i); // unlock it
#else
  while (ht1[hash]) {
    hash++;
    if (hash == size1) hash = 0;
  }
  ht1[hash] = relation2 + i;
#endif
}
*/


inline bool equals(struct relationInfo *left, uint64 leftrow, uint64 leftattribute
                    , struct relationInfo *right, uint64 rightrow, uint64 rightattribute) {
  /* Convenience function for evaluating equi-join conditions */
  uint64 leftval = left->relation[leftrow*left->fields + leftattribute];
  uint64 rightval = right->relation[rightrow*right->fields + rightattribute];
  return leftval == rightval;
}


          // can be just the necessary schema
  class MaterializedTupleRef_V1_0 {

    public:
    int64_t _fields[1];
    

    int64_t get(int field) const {
      return _fields[field];
    }
    
    void set(int field, int64_t val) {
      _fields[field] = val;
    }
    
    int numFields() const {
      return 1;
    }
    
    MaterializedTupleRef_V1_0 () {
      // no-op
    }

    MaterializedTupleRef_V1_0 (std::vector<int64_t> vals) {
      for (int i=0; i<vals.size(); i++) _fields[i] = vals[i];
    }
    
    std::ostream& dump(std::ostream& o) const {
      o << "Materialized(";
      for (int i=0; i<numFields(); i++) {
        o << _fields[i] << ",";
      }
      o << ")";
      return o;
    }
    
    
    public:
    MaterializedTupleRef_V1_0 (relationInfo * rel, int row) {
      _fields[0] =         rel->relation[row*rel->fields + 0];
    
    }
    
  } ;
  std::ostream& operator<< (std::ostream& o, const MaterializedTupleRef_V1_0& t) {
    return t.dump(o);
  }

  

          // can be just the necessary schema
  class MaterializedTupleRef_V2_0_1 {

    public:
    int64_t _fields[2];
    

    int64_t get(int field) const {
      return _fields[field];
    }
    
    void set(int field, int64_t val) {
      _fields[field] = val;
    }
    
    int numFields() const {
      return 2;
    }
    
    MaterializedTupleRef_V2_0_1 () {
      // no-op
    }

    MaterializedTupleRef_V2_0_1 (std::vector<int64_t> vals) {
      for (int i=0; i<vals.size(); i++) _fields[i] = vals[i];
    }
    
    std::ostream& dump(std::ostream& o) const {
      o << "Materialized(";
      for (int i=0; i<numFields(); i++) {
        o << _fields[i] << ",";
      }
      o << ")";
      return o;
    }
    
    
    public:
    MaterializedTupleRef_V2_0_1 (relationInfo * rel, int row) {
      _fields[0] =         rel->relation[row*rel->fields + 0];
    _fields[1] =         rel->relation[row*rel->fields + 1];
    
    }
    
  } ;
  std::ostream& operator<< (std::ostream& o, const MaterializedTupleRef_V2_0_1& t) {
    return t.dump(o);
  }

  
std::vector<MaterializedTupleRef_V1_0> result;


StringIndex string_index;
void init( ) {
}


void query(struct relationInfo *resultInfo)
{
  printf("\nstarting Query\n");

  int numCounters = 7;
  int currCounter = 0;
  int *counters = mallocCounterMemory(numCounters);

  double start = timer();

  getCounters(counters, currCounter);
  currCounter = currCounter + 1; // 1
  
  uint64 resultcount = 0;
  struct relationInfo A_val;
  struct relationInfo *A = &A_val;


  // -----------------------------------------------------------
  // Fill in query here
  // -----------------------------------------------------------
  

  
 /*
=====================================
  Scan(R)
=====================================
*/

printf("V2 = Scan(R)\n");

struct relationInfo V2_val;

#ifdef __MTA__
  binary_inhale("R", &V2_val);
  //inhale("R", &V2_val);
#else
  inhale("R", &V2_val);
#endif // __MTA__

struct relationInfo *V2 = &V2_val;
// Compiled subplan for CProject($0)[CSelect(($1 = 3))[MemoryScan[CFileScan(public:adhoc:R)]]]

for (uint64_t i : V2->range()) {
          MaterializedTupleRef_V2_0_1 t_195(V2, i);

          if (( (t_195.get(1)) == (3) )) {
      MaterializedTupleRef_V1_0 t_194;
    t_194.set(0, t_195.get(0));
    result.push_back(t_194);
std::cout << t_194 << std::endl;
      
    }
    
       } // end scan over V2
       
std::cout << "Evaluating subplan CProject($0)[CSelect(($1 = 3))[MemoryScan[CFileScan(public:adhoc:R)]]]" << std::endl;
        


  // return final result
  resultInfo->tuples = A->tuples;
  resultInfo->fields = A->fields;
  resultInfo->relation = A->relation;

}



int main(int argc, char **argv) {

  struct relationInfo resultInfo;

  init();

  // Execute the query
  query(&resultInfo);

#ifdef ZAPPA
//  printrelation(&resultInfo);
#endif
//  free(resultInfo.relation);
}
