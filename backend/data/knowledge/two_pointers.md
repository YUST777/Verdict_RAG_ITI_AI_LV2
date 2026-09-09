# Two Pointers and Sliding Windows

Two pointers are useful when progress in one direction makes an opposing boundary move monotonically. On sorted arrays, pointers at opposite ends can search for sums or pairs. In contiguous-subarray problems with nonnegative values, a right pointer expands the window and a left pointer shrinks it until an invariant is restored. Since each pointer advances at most `n` times, the scan is `O(n)`.

Sliding windows require careful validity assumptions. A simple shrink-while-invalid strategy may fail when negative values destroy monotonicity. Frequency maps support windows with distinctness or count constraints. State the window invariant before coding, update state in a consistent order, and decide whether the answer is recorded before or after shrinking.
