# Binary Search and Binary Search on the Answer

Binary search applies when a sorted search space or monotonic predicate divides candidates into two contiguous regions. For a predicate `feasible(x)`, determine whether it changes from false to true or true to false, maintain a documented invariant, and move one boundary each iteration. Integer implementations should use an overflow-safe midpoint and finish with the smallest or largest feasible candidate required by the problem.

Binary search on the answer does not require an explicitly sorted array. It requires an ordered candidate answer and a monotonic feasibility test. Common signals include minimizing a maximum load, maximizing a minimum distance, or finding the least time needed to produce a target amount. Derive bounds from constraints, prove monotonicity, and compute feasibility without exceeding integer limits. Complexity is normally `O(C log R)`, where `C` is the feasibility-check cost and `R` is the answer range.
