# MODULE 3: DESIGN AND ANALYSIS OF ALGORITHMS (DAA)
*(Complete Verbatim Notes with Exact Diagrams, Traces & Algorithms from all 33 Pages)*

---

# Transform and Conquer Approach :

Transform and conquer is an algorithmic strategy in which the problem is solved by applying transformations.

This method works as two-stage procedures.
* $\rightarrow$ **First, in the transformation stage**, the problem's instance is modified to be for one reason or another more amenable to solution.
* **Then, in the second or conquering stage**, it is solved.

### How to apply these transformations ?
There are three major variations of this idea that differ by what we transform a given instance to :

---

### a) Instance simplification :
**Transformation to a simpler or more convenient instance of the same problem.**

**Eg:** consider the sequence of disks (shaded, plain and striped).

```
Unsorted sequence of disks:
   [ Striped ⊕ ]   [ Plain ○ ]   [ Shaded ● ]   [ Striped ⊕ ]   [ Plain ○ ]   [ Shaded ● ]   [ Plain ○ ]
```

To identify the uniqueness of disks, one can arrange the disks as shown below -

```
Arranged (sorted) sequence:
   [ Striped ⊕ ]   [ Shaded ● ]   [ Shaded ● ]   [ Plain ○ ]   [ Plain ○ ]   [ Plain ○ ]
```

Now, it is easier to evaluate the uniqueness of the disks, as only the adjacent disk needs to be checked. Thus, the striped disk can be found to be unique. It can be observed that problem complexity is not reduced, but the task of recognition is simplified.

---

### b) Representation change :
**Transformation to a different representation of the same instance.**

**Eg:** Multiplication of Roman numbers is difficult. Hence, the numbers are converted into another representation, that is, decimal Arabic number system, which is familiar and convenient to use. In this case, multiplication is carried out in the new representation. After multiplication, the result is converted back to the Roman number system.

The change of representation simplifies the complexity of problem solving.

```
Roman number system:          XII    *    II
                               │          │
   change of representation    │          │     Send Result as
                               ▼          ▼           XXIV
Decimal system:                12    *    2    =   24 ─────────┘
```

* **Eg:** Heapsort is also one good example for this. In heapsort, an array of numbers is transformed into a heap and the numbers are sorted using the heap property.
* **Eg:** Polynomial Evaluation using the Horner's method.
* **Eg:** Binary Exponentiation.

---

### c) Problem reduction :
**Transformation to an instance of a different problem for which an algorithm is already available.**

**Eg.** Computing the LCM from GCD.  
Hypothetically, let us assume that an algorithm exists only for GCD. If so, then the problem of LCM can be converted to the problem of GCD using the following equation :

$$\text{LCM}(m, n) = \frac{m \times n}{\text{GCD}(m, n)}$$

```
+--------------------+   Problem Reduction    +--------------------+
|  LCM Computation   | ─────────────────────> |  GCD Computation   |
+--------------------+                        +--------------------+
```

The success of problem reduction lies in the identification of a way to reduce an unfamiliar problem into a problem of a familiar domain.

---

### Fig. Transform and Conquer

```
                     ┌──────────────────────────────────┐
                     │         Simpler instance         │
                     └──────────────────────────────────┘
                                      or
┌──────────────────┐ ┌──────────────────────────────────┐ ┌──────────────┐
│ Problem's        │ │      Representation change       │ │   Solution   │
│ instance         ├─┼──────────────────────────────────┼─┤              │
└──────────────────┘ └──────────────────────────────────┘ └──────────────┘
                                      or
                     ┌──────────────────────────────────┐
                     │        Problem reduction         │
                     └──────────────────────────────────┘
                                Transformation.

                          Fig. Transform and Conquer.
```

*(Page 84)*

---

# Presorting

Presorting is a problem-solving technique in which the input data is sorted first, and then the actual problem is solved more efficiently using the sorted data. Sorting organizes the data so that many operations like searching, comparison, and grouping become faster and simpler.

### Need of Presorting:
Sorting takes $O(n \log n)$ time. After sorting, many problems can be solved in linear time $O(n)$ or logarithmic time $O(\log n)$. Therefore, the total complexity remains $O(n \log n)$, which is better than naive approaches that may take $O(n^2)$.

---

### Example 1: Uniqueness of Elements

#### Problem:
Check whether all elements in an array are distinct.

#### Explanation:
If the array is sorted, duplicate elements will appear next to each other. So instead of comparing every pair, we only need to check adjacent elements. This reduces the number of comparisons significantly.

#### Algorithm:
```text
ALGORITHM PresortElementUniqueness(A[0..n - 1])
// Solves the element uniqueness problem by sorting the array first
// Input: An array A[0..n - 1] of orderable elements
// Output: Returns "true" if A has no equal elements, "false" otherwise
sort the array A
for i <- 0 to n - 2 do
    if A[i] == A[i + 1] return false
return true
```

#### Time Complexity:
* Sorting: $O(n \log n)$
* Checking: $O(n)$
* **Total: $O(n \log n)$**

---

### Example 2: Finding Mode

#### Problem:
Find the element that appears most frequently in the array.

#### Explanation:
After sorting, identical elements are grouped together. We can count consecutive occurrences of elements and track the element with the highest frequency.

#### Algorithm:
```text
ALGORITHM PresortMode(A[0..n - 1])
// Computes the mode of an array by sorting it first
// Input: An array A[0..n - 1] of orderable elements
// Output: The array's mode
sort the array A
i <- 0 // current run begins at position i
modefrequency <- 0 // highest frequency seen so far
while i <= n - 1 do
    runlength <- 1; runvalue <- A[i]
    while i + runlength <= n - 1 and A[i + runlength] == runvalue do
        runlength <- runlength + 1
    if runlength > modefrequency
        modefrequency <- runlength; modevalue <- runvalue
    i <- i + runlength
return modevalue
```

#### Time Complexity:
* Sorting: $O(n \log n)$
* Counting: $O(n)$
* **Total: $O(n \log n)$**

---

### 5. Searching using Presorting

#### Problem:
Search for an element efficiently in an array.

#### Explanation:
After sorting, binary search can be applied. Binary search repeatedly divides the search space into halves, making it much faster than linear search for large datasets.

#### Algorithm:
```text
Algorithm:
BinarySearch(A, n, key)
 low <- 0
 high <- n - 1
 while low <= high do
     mid <- (low + high) / 2
     if A[mid] == key then
         return mid
     else if key < A[mid] then
         high <- mid - 1
     else
         low <- mid + 1
 return -1
```

#### Time Complexity:
* Sorting: $O(n \log n)$
* Binary Search: $O(\log n)$
* **Total: $O(n \log n)$**

---

# Transform and Conquer approach :
## Heaps and Heap sort

Heap is a complete binary tree or a almost complete binary tree in which every parent node be either greater or lesser than its child nodes.

The binary tree is essentially complete, i.e all its levels are full except possibly the last level where only right-most leaves may be missing.

```
       Eg:                 ( 10 )                         ( 23 )
                          /      \                       /      \
                       ( 5 )    ( 7 )                 ( 18 )   ( 16 )
                      /    \    /                    /     \
                    ( 4 ) ( 2 )( 1 )               ( 9 )  ( 7 )
```

$\rightarrow$ Heap can be min heap or max heap.  
$\rightarrow$ **A Max heap** is a tree in which value of each node is greater than or equal to the value of its children node.

```
       Eg:                 ( 18 )                         ( 10 )
                          /      \                        /
                       ( 12 )   ( 4 )                   ( 8 )
                       /    \                           /
                     ( 11 ) ( 10 )                    ( 7 )
```

$\rightarrow$ **A min heap** is a tree in which value of each node is less than or equal to value of its children nodes.

```
       Eg:                 ( 4 )                          ( 7 )
                          /     \                        /     \
                       ( 12 )  ( 14 )                 ( 15 )  ( 18 )
                       /    \  /    \                 /    \
                     ( 18 )(20)(25)(45)             ( 20 )( 25 )
```

---

### Parental Property
Parent being greater or lesser in heap is called **Parental property**. Thus heap has two important properties.

```
               ┌──> It should be a complete binary tree / Almost complete binary tree
        Heap ──┤
               └──> It should satisfy parental property
```

### Level of binary tree :-
The root of the tree is always at level 0. Any node is always at a level one more than its parent nodes level.

```
Level 0 ───>                     ( 10 )
                                /      \
Level 1 ───>                 ( 20 )    ( 30 )
                             /    \        \
Level 2 ───>              ( 40 )  ( 50 )   ( 60 )
```

### Height of the tree :-
The maximum level is the height of the tree. The height of the tree is also called **depth** of the tree.

```
                 ┬               ( 10 )      level 0
                 │              /      \
                 │           ( 20 )    ( 30 ) level 1
       height    │           /    \        \
                 │        ( 40 )  ( 50 )   ( 60 ) level 2
                 ┴
```
The max level of this tree is 2. Hence **height of this tree is 2**.

*(Page 81)*

---

### Complete binary tree :
The complete binary tree is a binary tree in which all leaves are at the same depth or total number of nodes at each level $i$ are $2^i$.

```
Level 0:                               ( 10 )
                                     /        \
Level 1:                         ( 20 )      ( 30 )
                                /     \      /     \
Level 2:                     ( 40 )  ( 50 ) ( 60 ) ( 70 )
                             /   \   /   \  /   \  /   \
Level 3:                    (80)(90)(91)(92)(93)(94)(95)(96)
```

**Note:** Total no of nodes in complete binary tree are $2^{h+1} - 1$, where $h$ is height of tree.  
In the given tree height = 3.  
$$\because 2^{3+1} - 1 = 2^4 - 1 = 16 - 1 = 15$$
$$\therefore \text{Total 15 nodes in this complete binary tree.}$$

---

### Almost complete binary tree :-
It is a tree in which -
* **(i)** Each node has a left child whenever it has a right child. That means there is always a left child, but for a left child there may not be a right child.
* **(ii)** The leaf in a tree must be present at height $h$ or $h-1$. That means all the leaves are on two adjacent levels.

```
Eg.
         ( 10 )                       ( 10 )                          ( 10 )
        /      \                     /      \                        /      \
     ( 20 )   ( 30 )              ( 20 )   ( 30 )                 ( 20 )   ( 30 ) level 1
     /    \                                     \                 /
  ( 40 ) ( 50 )                                ( 50 )          ( 40 )
                                                                /
(a) Almost complete          (b) Not almost                   ( 50 ) level 3
    binary tree                  binary tree              (c) Not almost
                             (∵ 1st property not              binary tree
                                 satisfied)               (∵ 2nd property not
                                                              satisfied)
```

---

### Properties of heap :
1. There should be either "complete binary tree" or "almost complete binary tree".
2. The root of a heap always contains its largest element.
3. Each subtree in a heap is also a heap.

```
Eg.                    ( 20 )
                      /      \
             ┌───────┐        ┌───────┐
             │ ( 10 )│        │ ( 8 ) │
             │ /    \│        │ /   \ │
             │(3)  (4)│       │(6)  (7)│
             └───────┘        └───────┘
          [ Subtree 1 ]      [ Subtree 2 ]
```

4. Heap can be implemented as array by recording its elements in the top-down and left to right fashion. $i$ represents index.

**For array $A[\text{size}]$ :**
* $\rightarrow$ Root node is stored at $A[0]$
* $\rightarrow$ left child is at $2i+1$ position in array $A$
* $\rightarrow$ Right child is at $2i+2$ position in array $A$
* $\rightarrow$ Parent node is at $\lfloor \frac{i-1}{2} \rfloor$ position in Array $A$.

```
Eg.
                 ( 20 )
                /      \                    0     1     2     3     4     5     6
             ( 10 )    ( 8 )       ===>   ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐
            /    \     /   \              │ 20  │ 10  │  8  │  3  │  4  │  6  │  7  │
          ( 3 )  ( 4 )( 6 ) ( 7 )         └─────┴─────┴─────┴─────┴─────┴─────┴─────┘
                                           Root
                                           A[0]   └──Left/Right─┘     └──Left/Right─┘
                                                  Children of 10      Children of 8
```

**Thus array can represent complete heap.**

*(Page 82)*

---

# Construction of Heap :
Two approaches are there :
* **a) Top down heap construction**
* **b) Bottom up heap construction**

### a) Top down heap construction :
This method constructs a heap by successive insertions of a new key into a previously constructed heap.
* $\rightarrow$ First, attach a new node with key $k$ in it after the last leaf of the existing heap.
* $\rightarrow$ Then sift $k$ up to its appropriate place in the new heap as follows -
  * $*$ compare $k$ with its parent's key : If the latter is greater than or equal to $k$, Stop.
  * $*$ otherwise, swap these two keys and compare $k$ with its new parent.
  * $*$ this swapping continues until $k$ is not greater than its last parent or it reaches the root.

---

### Bottom-up heap construction algorithm :
This algorithm initializes the essentially complete binary tree with $n$ nodes by placing keys in the order given and then "heapifies" the tree as follows:

Starting with the last parental node, the algorithm checks whether the parental dominance holds for the key at this node. If it does not, the algorithm exchanges the node's key $k$ with the larger key of its children and checks whether the parental dominance holds for $k$ in its new position. This process continues until the parental dominance requirement for $k$ is satisfied.

After completing the "heapification" of the subtree rooted at the current parental node, the algorithm proceeds to do the same for the node's immediate predecessor. The algorithm stops after this is done for the tree's root.

*(Page 85)*

---

### ALGORITHM Heap BottomUp (H[1..n])
```text
// Constructs a heap from the elements of a given array by the bottom-up algorithm
// Input : An array H[1..n] of orderable items
// Output : A heap H[1..n]

for i <- floor(n/2) downto 1 do
    k <- i;
    v <- H[k]
    heap <- false
    while not heap and 2 * k <= n do
        j <- 2 * k
        if j < n // there are two children
            if H[j] < H[j + 1]
                j <- j + 1
        if v >= H[j]
            heap <- true
        else
            H[k] <- H[j];
            k <- j
    H[k] <- v
```

### How To construct a heap for a given list of keys ?
There are two approaches for the construction of heap :
* **(i) Top-down approach $O(n \log n)$**
* **(ii) Bottom up approach $O(\log n)$** *(corrected to $O(n)$)*

**Note :** Top-down approach is not economical in terms of time complexity, so we are considering bottom up approach.

---

# Create a Heap (Bottom-up Heap construction)

Create a heap for the elements **5, 35, 25, 45, 20, 55, 25, 45, 50, 10, 30 and 15** using bottom up approach.

**Sol :-** Even though tree structure is used, we use array to store the heap elements. The given elements are stored in an array as shown below:

```
Index:  0    1    2    3    4    5    6    7    8    9   10   11
      ┌────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┐
Value:│ 5  │ 35 │ 25 │ 45 │ 20 │ 55 │ 25 │ 45 │ 50 │ 10 │ 30 │ 15 │
      └────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┘
```

The above array elements can be represented in the form of a tree as shown below :

```
                                  ( 5 )
                               /         \
                       ( 35 )               ( 25 )
                      /      \             /      \
                  ( 45 )     ( 20 )     ( 55 )    ( 25 )
                 /     \     /    \      /
              ( 45 )  ( 50)( 10 ) ( 30)( 15 )
```

---

### Step 1 :- Consider the last non-leaf node 55 -
Compare 55 with its children. Clearly, 55 is greater than its child 15.  
**Subtree satisfies the heap condition and no change is required.**

---

### Step 2 :- Consider the last non-leaf node 20 -
* Compare 20 with its children 10 and 30.
* clearly 20 is greater than 10 and less than 30.
* subtree is not a heap.
* we must swap 20 and 30 to make it a heap.

```
                                  ( 5 )
                               /         \
                       ( 35 )               ( 25 )
                      /      \             /      \
                  ( 45 )     ( 30 )     ( 55 )    ( 25 )
                 /     \     /    \      /
              ( 45 )  ( 50)( 10 ) ( 20)( 15 )
```

---

### Step 3 :- Consider the last non-leaf node 45 -
* compare 45 with its children 45 and 50.
* clearly 45 is equal to its left child 45 and less than its right child 50.
* subtree is not a heap.
* To make it a heap, swap 45 and 50.

```
                                  ( 5 )
                               /         \
                       ( 35 )               ( 25 )
                      /      \             /      \
                  ( 50 )     ( 30 )     ( 55 )    ( 25 )
                 /     \     /    \      /
              ( 45 )  ( 45)( 10 ) ( 20)( 15 )
```

---

### Step 4 :- Consider the last non leaf node 25 :
* compare 25 with its children 55 and 25.
* clearly 25 is less than its left child 55.
* Subtree is not a heap.
* To make it a heap, swap 25 and 55.

```
                                  ( 5 )
                               /         \
                       ( 35 )               ( 55 )
                      /      \             /      \
                  ( 50 )     ( 30 )     ( 25 )    ( 25 )
                 /     \     /    \      /
              ( 45 )  ( 45)( 10 ) ( 20)( 15 )
```

---

### Step 5 :- Consider the last non leaf node 35 :
* compare 35 with its children 50 and 30.
* clearly 35 is less than its left child 50.
* Subtree is not a heap.
* To make it a heap, swap 35 and 50.

```
                                  ( 5 )
                               /         \
                       ( 50 )               ( 55 )
                      /      \             /      \
                  ( 35 )     ( 30 )     ( 25 )    ( 25 )
                 /     \     /    \      /
              ( 45 )  ( 45)( 10 ) ( 20)( 15 )
```

After swapping 35 and 50, check whether subtree identified by root node 35 forms a heap.

Comparing 35 with 45 and 45. clearly it is not a heap. So, 35 should be exchanged with largest of two children. Since left child and right child are same, we can exchange either with left child or right child. Let us exchange with left child and the resulting tree is shown below :

```
                                  ( 5 )
                               /         \
                       ( 50 )               ( 55 )
                      /      \             /      \
                  ( 45 )     ( 30 )     ( 25 )    ( 25 )
                 /     \     /    \      /
              ( 35 )  ( 45)( 10 ) ( 20)( 15 )
```

---

### Step 6 :- consider the last non leaf node 5 -
Swap 5 with largest of two children.  
Swap 5 with its right child 55 and the resulting tree is shown below :

```
                                 ( 55 )
                               /        \
                       ( 50 )              ( 5 )
                      /      \            /     \
                  ( 45 )     ( 30 )    ( 25 )   ( 25 )
                 /     \     /    \     /
              ( 35 )  ( 45)( 10 ) ( 20)( 15 )
```

Node 5 is compared with children 25 and 25 $\implies$ swap 5 with 25:
```
                                 ( 55 )
                               /        \
                       ( 50 )             ( 25 )
                      /      \            /     \
                  ( 45 )     ( 30 )     ( 5 )   ( 25 )
                 /     \     /    \     /
              ( 35 )  ( 45)( 10 ) ( 20)( 15 )
```

After swapping 5 and 15, the following tree is obtained.

```
                                 ( 55 )
                               /        \
                       ( 50 )             ( 25 )
                      /      \            /     \
                  ( 45 )     ( 30 )    ( 15 )   ( 25 )
                 /     \     /    \     /
              ( 35 )  ( 45)( 10 ) ( 20)( 5 )
```

---

### Additional Heap Examples

#### Construct a heap for the list 10, 8, 1, 5, 6, 4, 9
**Solution :- By bottom-up algorithm -**

```
        ( 10 )                          ( 10 )
       /      \                        /      \
    ( 8 )    ( 1 )  ===[heapify 1]===> ( 8 )   ( 9 )
    /   \    /   \                     /   \   /   \
  ( 5 ) ( 6)( 4 ) ( 9 )              ( 5 ) ( 6)( 4 )( 1 )
 Complete binary tree                       Max heap
```

---

#### Construct a heap for the list - 15, 19, 11, 14, 18, 20, 19, 24
**Solution :- By bottom-up algorithm :**

```
                 ( 15 )                                      ( 15 )
                /      \                                    /      \
            ( 19 )     ( 11 )                           ( 19 )     ( 20 )
           /      \    /    \                          /      \    /    \
        ( 14 )   ( 18)( 20 )( 19 )                  ( 24 )   ( 18)( 11 )( 19 )
        /                                           /
      ( 24 )                                      ( 14 )
  Almost complete binary tree               [Heapify 14 & 24, then 11 & 20]

                 ( 15 )                                      ( 24 )
                /      \                                    /      \
            ( 24 )     ( 20 )                           ( 15 )     ( 20 )
           /      \    /    \                          /      \    /    \
        ( 19 )   ( 18)( 11 )( 19 )                  ( 19 )   ( 18)( 11 )( 19 )
        /                                           /
      ( 14 )                                      ( 14 )
     [Heapify 19 & 24]                           [Heapify root 15 & 24]

                                     ( 24 )
                                    /      \
                                ( 19 )     ( 20 )
                               /      \    /    \
                            ( 15 )   ( 18)( 11 )( 19 )
                            /
                          ( 14 )
                                 Max heap
```

*(Page 86)*

---

# Heap sort :
It works in two stages :
```
               ┌──> Heap Construction
   Heap sort ──┤
               └──> deletion of max key
```

**Note :-**
* For descending order, Max heap is created.
* For ascending order, Min heap is created.

---

### Construct a heap for the list 2 9 7 6 5 8 using bottom-up algorithm and sort them in Descending order.
**Sol :- Descending**

#### Stage 1 : Heap construction
```
       ( 2 )                      ( 2 )                      ( 9 )                      ( 9 )
      /     \                    /     \                    /     \                    /     \
   ( 9 )   ( 7 )  ==heapify 7==> ( 9 ) ( 8 ) ===heapify 2==> ( 2 ) ( 8 ) ===sift 2===> ( 6 )   ( 8 )
   /   \   /                     /   \ /                    /   \ /                    /   \ /
 ( 6 ) ( 5)( 8 )               ( 6 ) ( 5)( 7 )            ( 6 ) ( 5)( 7 )            ( 2 ) ( 5)( 7 )
```

**Array transitions :**
```
2  9  7  6  5  8
2  9  8  6  5  7
2  9  8  6  5  7
9  2  8  6  5  7
9  6  8  2  5  7
```

#### Stage 2 : Maximum deletions

* **Delete 9 :** Swap 9 with last element 7 $\rightarrow$ `7 6 8 2 5 | 9`. Sift 7 down with 8:
```
       ( 7 )                      ( 8 )
      /     \                    /     \
   ( 6 )   ( 8 )  ===heapify==> ( 6 )   ( 7 )
   /   \                        /   \
 ( 2 ) ( 5 )                  ( 2 ) ( 5 )
```

* **Delete 8 :** Swap 8 with last element 5 $\rightarrow$ `5 6 7 2 | 8`. Sift 5 down with 7:
```
       ( 5 )                      ( 7 )
      /     \                    /     \
   ( 6 )   ( 7 )  ===heapify==> ( 6 )   ( 5 )
   /                            /
 ( 2 )                        ( 2 )
```

* **Delete 7 :** Swap 7 with last element 2 $\rightarrow$ `2 6 5 | 7`. Sift 2 down with 6:
```
       ( 2 )                      ( 6 )
      /     \                    /     \
   ( 6 )   ( 5 )  ===heapify==> ( 2 )   ( 5 )
```

* **Delete 6 :** Swap 6 with last element 5 $\rightarrow$ `5 2 | 6`.
```
       ( 5 )
      /
   ( 2 )
  (5 dont Heapify. As it holds Parental dominance)
```

* **Delete 5 :** Swap with 2 $\rightarrow$ `2 | 5`
* Only one node is present : `2`

```
Summary of Deletion States :
9  6  8  2  5  7
7  6  8  2  5 | 9
8  6  7  2  5
5  6  7  2 | 8
7  6  5  2
2  6  5 | 7
6  2  5
5  2 | 6
5  2
2 | 5
2
```

---

### Assignment :
1) Construct a heap for the list 1, 8, 6, 5, 3, 7, 4 by the bottom-up algorithm.  
2) Sort the below given lists by heapsort using the array representation of heaps.  
   a. 3, 2, 4, 1, 6, 5 (increasing order)  
   b. 3, 4, 2, 1, 5, 6 (decreasing order)  
   c. H, E, A, P, S, O, R, T (alphabetical order)  
3) Write an efficient program for maximum key deletion from a given heap.  
4) Design an efficient algorithm for finding and deleting an element of the smallest value in a heap and determine its time efficiency.  

*(Page 88)*

5) Implement three advanced sorting algorithms - mergesort, quicksort, and heapsort in the language of your choice and investigate their performance on arrays of sizes $n = 10^2, 10^3, 10^4, 10^5 \text{ and } 10^6$. For each of these sizes, consider
   a) randomly generated files of integers in the range $[1..n]$  
   b) increasing files of integers $1, 2, ..., n$  
   c) decreasing files of integers $n, n-1, ..., 1$  

### Features of heap sort :
1. The time complexity of heap sort is $O(n \log n)$.
2. This is an in-place sorting algorithm. That means it does not require extra storage space while sorting the elements.
3. For random input it works slower than quick sort.
4. Heap sort is not a stable sorting method.
5. The space complexity of heap sort is $O(1)$. As it does not require any extra storage to sort.

**Note :** The heap can be represented by binary tree or array.  
**Why array based representation for binary heap?**  
Since a binary heap is a complete binary tree, it can be easily represented as array and array based representation is space efficient.

---

### Maximum key deletion from a heap :
The procedure to be followed for deleting the maximum element from a given heap is as follows -
* **Step 1 :-** Exchange the root's key with the last key $k$ of the heap.
* **Step 2 :-** Decrease the heap's size by 1.
* **Step 3 :-** Heapify the smaller tree by shifting $k$ down the tree, until the parental dominance condition holds for $k$.

**Example :** Demonstrate the maximum key deletion from the foll. given heap.

```
Given heap:               ( 9 )
                         /     \
                      ( 8 )   ( 6 )
                      /   \   /
                    ( 2 ) ( 5)( 1 )
```

**Solution :-**

```
Step 1: Swap 9 & 1            Step 2: Remove 9             Step 3: Heapify 1
         ( 1 )                         ( 1 )                        ( 8 )
        /     \                       /     \                      /     \
     ( 8 )   ( 6 )      ===>       ( 8 )   ( 6 )      ===>      ( 5 )   ( 6 )
     /   \   /                     /   \                        /   \
   ( 2 ) ( 5)( 9 )               ( 2 ) ( 5 )                  ( 2 ) ( 1 )
```

---

**Note :-** The data structure called the "heap" is a partially ordered data structure that is especially suitable for implementing priority queues.  
Priority queue has the following operations :
1. Finding an item with the highest priority.
2. Deleting an item with the highest priority.
3. Adding a new item to the multiset.

Priority queues finds its applications in scheduling job executions by computer operating systems and traffic management by communication networks.

**Assignment**  
Construct a max heap for the foll. elements  
`10   9   6   5   7   8`

---

### Time complexity analysis for heap sort :
This algo works in two stages, we get the running time.

$$\text{Running time for heap sort} = \text{Running time required by heap construction} + \text{Running time required by deletion of root key}$$

$$C(n) = C_1(n) + C_2(n) \quad \text{---(1)}$$

Heap construction requires $O(n)$ time.
$$C_1(n) = O(n).$$

Now, let us compute time required by second stage. Let no. of key comparisons needed for eliminating root keys from heap are for size from $n$ to 2. Then, we can establish the foll. relation :

$$C_2(n) \le 2 \lfloor \log_2 (n-1) \rfloor + 2 \lfloor \log_2 (n-2) \rfloor + \dots + 2 \lfloor \log_2 1 \rfloor$$
$$\le 2 \sum_{i=1}^{n-1} \log_2 i$$

$$\text{formula: } \sum_{i=1}^n \log_2 i = n \log_2 n$$
$$\text{Similarly, } \sum_{i=1}^{n-1} \log_2 i = (n-1) \log_2 (n-1)$$

$$\le 2 (n-1) \log_2 (n-1)$$
$$\le (2n - 2) \log_2 (n-1)$$
$$\le 2n \log_2 (n-1) - 2 \log_2 (n-1)$$
$$\le 2n \log_2 n$$
$$C_2(n) = O(n \log_2 n)$$

Substituting $C_1(n)$ and $C_2(n)$ in eq (1).
$$C(n) = O(n) + O(n \log_2 n)$$
$$\mathbf{C(n) = O(n \log_2 n)}$$

**Note: Analysis :** The basic operation in deletion algorithm is the key comparison that should be made to "heapify" the tree after the swap has been made. Each time, after deletion the size of the tree is decreased by 1. It requires less number of key comparisons than twice the heap's height. Therefore time complexity of deletion of $O(\log n)$.

---

# Space-Time Tradeoffs - Sorting by Counting

Space- and time trade offs in algorithm design are a well known issue for both theoreticians and practitioners for computing

The idea is to process the problem's input, in whole or in part and store the additional information obtained to accelerate solving the problem afterward.

The approach is also called as **input enhancement**.

Based on that
1. counting methods for sorting
2. Boyer Moore algorithm for string matching suggested by Horspool.

### Sorting by counting
Applying the input-enhancement technique to the sorting problem.

Count for each element of a list to be sorted, the total no of elements smaller than this element and record the results in a table. The no will indicate the positions of the elements in the sorted list.

Also called as **comparision counting sort**

---

### Example
$$A[0..5]:$$

```
 0    1    2    3    4    5
┌────┬────┬────┬────┬────┬────┐
│ 62 │ 31 │ 84 │ 96 │ 19 │ 47 │
└────┴────┴────┴────┴────┴────┘
```

**Initially `count[]` :**
```
Initially:       count[]:  0   0   0   0   0   0
i = 0                      3   0   1   1   0   0
                               1   2   2   0   1
                                   4   3   0   1
                                       5   0   1
                                           0   2
------------------------------------------------
Final counts:              3   1   4   5   0   2
```

**Final sorted array placing $S[\text{count}[i]] \leftarrow A[i]$ :**
```
 0    1    2    3    4    5
┌────┬────┬────┬────┬────┬────┐
│ 19 │ 31 │ 47 │ 62 │ 84 │ 96 │
└────┴────┴────┴────┴────┴────┘
```

---

### Algorithm Comparision CountingSort (A[0..n-1])
```text
// Sorts an array by comparision counting
// Input : An array A[0..n-1] of orderable elements
// Output : Array S[0..n-1] A's elements in non decreasing order.

for i <- 0 to n-1 do count[i] <- 0
for i <- 0 to n-2 do
    for j <- i+1 to n-1 do
        if A[i] < A[j]
            count[j] <- count[j] + 1
        else
            count[i] <- count[i] + 1
for i <- 0 to n-1 do S[count[i]] <- A[i]
return S
```

### Time efficiency :
$$C(n) : \sum_{i=0}^{n-2} \sum_{j=i+1}^{n-1} 1$$
$$= \sum_{i=0}^{n-2} [(n - 1) - (i + 1) + 1]$$
$$= \sum_{i=0}^{n-2} (n - 1 - i) = \frac{n(n - 1)}{2}$$
$$\mathbf{= O(n^2)}$$

---

# Horspool Algorithm

* used for pattern matching
* to find a substring in a given string

```
Given string
  ↓
┌───┬───┬───┬───┬───┬───┬───┬───┐
│   │   │   │   │   │   │   │   │
└───┴───┴───┴───┴───┴───┴───┴───┘

pattern string
  ↓
┌───┬───┬───┐
│   │   │   │
└───┴───┴───┘
```

Shifts more than '1' position  
To decide the position shift table is constructed.

---

### (1) Consider the pattern string BANGALORE
Length of string is 9

```
┌───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┐
│ A │ B │ C │ D │ E │ F │ G │ H │ I │ J │ K │ L │ M │ N │ O │ P │ Q │ R │ S │ T │ U │ V │ W │ X │ Y │ Z │   │
├───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┤
│ 9 │ 9 │ 9 │ 9 │ 9 │ 9 │ 9 │ 9 │ 9 │ 9 │ 9 │ 9 │ 9 │ 9 │ 9 │ 9 │ 9 │ 9 │ 9 │ 9 │ 9 │ 9 │ 9 │ 9 │ 9 │ 9 │ 9 │
└───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┘
  7   8                   5                   3       6   2           1
  4
```

---

### Algorithm
`P` array stores the pattern  
Length of the pattern is $m$.  
pattern is stored in $P$ from $0$ to $m-1$  
$ST[0 \text{ to } \text{csize}-1]$ is the shift table where $\text{csize}$ is alphabet size.  
$\text{csize} = 256$ for all the ASCII characters,  
$\text{csize} = 26$

**Input: pattern string $P \quad$ output : shift table $ST$.**

```text
Algorithm Shift-table (P, ST)
{
    for i = 0 to csize - 1
        ST[i] = m;
    for j = 0 to m - 2
    {
        index = ASCII value of P[j] - ASCII value of 'A';
        ST[index] = m - 1 - j;
    }
}
```

---

### Ex:- Pattern string: KANNADA

```
  0   1   2   3   4   5   6                size = 27
┌───┬───┬───┬───┬───┬───┬───┐
│ K │ A │ N │ N │ A │ D │ A │               m = 7
└───┴───┴───┴───┴───┴───┴───┘
```

```
┌───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┐
│ A │ B │ C │ D │ E │ F │ G │ H │ I │ J │ K │ L │ M │ N │ O │ P │ Q │ R │ S │ T │ U │ V │ W │ X │ Y │ Z │   │
├───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┤
│ 7 │ 7 │ 7 │ 7 │ 7 │ 7 │ 7 │ 7 │ 7 │ 7 │ 7 │ 7 │ 7 │ 7 │ 7 │ 7 │ 7 │ 7 │ 7 │ 7 │ 7 │ 7 │ 7 │ 7 │ 7 │ 7 │ 7 │
└───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┘
  5           1                           6           4
  2                                                   3
```
* Under `A`: 7 crossed out $\rightarrow$ 5 crossed out $\rightarrow$ **2**
* Under `D`: 7 crossed out $\rightarrow$ **1**
* Under `K`: 7 crossed out $\rightarrow$ **6**
* Under `N`: 7 crossed out $\rightarrow$ 4 crossed out $\rightarrow$ **3**
* All other characters remain **7**.

---

### Matching Trace :
```
  1 2 3 4 5 6     │
┌───┬───┬───┬───┬───┬───┬───┐   ┌───┬───┬───┬───┬───┬───┬───┐
│ I │   │ S │ P │ E │ A │ K │   │ K │ A │ N │ N │ A │ D │ A │
└───┴───┴───┴───┴───┴───┴───┘   └───┴───┴───┴───┴───┴───┴───┘
  K   A   N   N   A   D   A                       ▲
                                                  │
                                    X   K   A   N   N   A   D   A
                                        K   A   N   N   A   D   A
```

---

### Horspool algorithm
```text
Algorithm Horspool (S, P)
{
    n = length(S);
    m = length(P);
    ShiftTable(P, ST);
    i = m - 1;          ------ Start the comparison from last character
    while (i <= n - 1)
    {
        k = 0;
        while (k <= m - 1 and P[m - 1 - k] == S[i - k])
            k = k + 1;
        if (k == m)
            return i - m + 1;
        else
            i = i + ST[S[i]];
    }
    return -1;
}
```
