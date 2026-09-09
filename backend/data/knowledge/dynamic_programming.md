# Dynamic Programming

Dynamic programming applies when a problem has overlapping subproblems and an optimal answer can be composed from smaller states. Define a state with all information needed for future decisions, specify its transition, base cases, evaluation order, and final state. Estimate `number of states × work per transition` before implementation.

Common forms include one-dimensional prefix decisions, two-dimensional sequence alignment, knapsack by item and capacity, and tree DP combining child results. Memoization mirrors a recurrence and visits reachable states; tabulation makes order and memory use explicit. Space can often be reduced when each layer depends only on the previous layer. A greedy shortcut is unsafe unless an exchange argument or other proof establishes it.
