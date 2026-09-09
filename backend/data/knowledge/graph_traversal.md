# Graph Traversal

Breadth-first search finds shortest paths by edge count in an unweighted graph. Initialize distances to an unreachable sentinel, assign the source distance zero, and mark a node when enqueuing it to avoid duplicates. Depth-first search is useful for connected components, cycle structure, trees, and traversal ordering. Both run in `O(V + E)` with adjacency lists.

For grids, each cell is a vertex and valid neighboring cells define edges. For trees, passing the parent prevents immediately returning over the same undirected edge. Recursive DFS can overflow the call stack on deep inputs, so iterative DFS or BFS is safer when constraints are large. Weighted shortest paths need another algorithm: 0-1 BFS for weights zero and one, or Dijkstra for nonnegative weights.
